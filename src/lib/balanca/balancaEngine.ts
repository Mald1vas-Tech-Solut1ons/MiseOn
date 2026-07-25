/**
 * MiseOn Scale Engine — Driver Inteligente de Integração com Balanças de Buffet
 * Suporta Web Serial API (USB/RS-232), TCP/IP Webhook e Emulador Integrado.
 */

import type { BalancaConfiguracao, ProtocoloBalanca } from '../../types';

export interface LeituraBalanca {
  pesoBrutoKg: number;
  taraKg: number;
  pesoLiquidoKg: number;
  estavel: boolean;
  timestamp: Date;
  rawFrame?: string;
}

export type ListenerBalanca = (leitura: LeituraBalanca) => void;

export class BalancaEngine {
  private config: BalancaConfiguracao;
  private listeners: Set<ListenerBalanca> = new Set();
  private serialPort: any = null;
  private reader: any = null;
  private conectando = false;
  private emuladorInterval: any = null;
  private ultimaLeitura: LeituraBalanca = {
    pesoBrutoKg: 0,
    taraKg: 0,
    pesoLiquidoKg: 0,
    estavel: true,
    timestamp: new Date(),
  };

  constructor(config: BalancaConfiguracao) {
    this.config = config;
  }

  public setConfig(novaConfig: BalancaConfiguracao) {
    this.config = novaConfig;
  }

  public onLeitura(listener: ListenerBalanca): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notificar(leitura: LeituraBalanca) {
    this.ultimaLeitura = leitura;
    this.listeners.forEach((fn) => fn(leitura));
  }

  public getUltimaLeitura(): LeituraBalanca {
    return this.ultimaLeitura;
  }

  /**
   * Conecta com a balança de acordo com o modo configurado
   */
  public async conectar(): Promise<boolean> {
    if (this.conectando) return false;
    this.conectando = true;

    try {
      if (this.config.modo_conexao === 'EMULADOR') {
        this.iniciarEmulador();
        return true;
      }

      if (this.config.modo_conexao === 'WEB_SERIAL') {
        return await this.conectarWebSerial();
      }

      if (this.config.modo_conexao === 'NETWORK_WEBHOOK') {
        // Modo de escuta de rede via webhook/bridge local
        console.log(`[BalancaEngine] Aguardando dados via IP: ${this.config.ip_dispositivo}:${this.config.porta_dispositivo}`);
        return true;
      }

      return false;
    } finally {
      this.conectando = false;
    }
  }

  public async desconectar(): Promise<void> {
    if (this.emuladorInterval) {
      clearInterval(this.emuladorInterval);
      this.emuladorInterval = null;
    }

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {
        console.warn('Erro ao cancelar reader serial:', e);
      }
      this.reader = null;
    }

    if (this.serialPort) {
      try {
        await this.serialPort.close();
      } catch (e) {
        console.warn('Erro ao fechar porta serial:', e);
      }
      this.serialPort = null;
    }
  }

  /**
   * Conexão via Web Serial API (Google Chrome, MS Edge, Brave)
   */
  private async conectarWebSerial(): Promise<boolean> {
    if (!('serial' in navigator)) {
      console.warn('[BalancaEngine] Web Serial API não suportada neste navegador.');
      return false;
    }

    try {
      // Solcita ao usuário a seleção da porta Serial/USB
      this.serialPort = await (navigator as any).serial.requestPort();
      await this.serialPort.open({
        baudRate: this.config.baud_rate || 9600,
        dataBits: this.config.data_bits || 8,
        stopBits: this.config.stop_bits || 1,
        parity: this.config.parity || 'none',
      });

      this.lerStreamSerial();
      return true;
    } catch (err) {
      console.error('[BalancaEngine] Falha ao conectar Web Serial:', err);
      return false;
    }
  }

  private async lerStreamSerial() {
    if (!this.serialPort || !this.serialPort.readable) return;

    const textDecoder = new TextDecoderStream();
    this.serialPort.readable.pipeTo(textDecoder.writable).catch(() => {});
    this.reader = textDecoder.readable.getReader();

    let buffer = '';

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          // Frames de balanças industriais terminam com \r ou \n ou ETX (\x03)
          // eslint-disable-next-line no-control-regex
          const linhas = buffer.split(/[\r\n\x03]+/);
          buffer = linhas.pop() || '';

          for (const linha of linhas) {
            const limpa = linha.trim();
            if (limpa) {
              const leitura = this.parseFrame(limpa, this.config.protocolo);
              if (leitura) this.notificar(leitura);
            }
          }
        }
      }
    } catch (error) {
      console.error('[BalancaEngine] Erro na leitura do stream serial:', error);
    } finally {
      this.reader.releaseLock();
    }
  }

  /**
   * Parser universal de frames para Toledo, Filizola, Urano e Genéricos
   */
  public parseFrame(rawFrame: string, protocolo: ProtocoloBalanca): LeituraBalanca | null {
    const taraKg = (this.config.tara_padrao_g || 0) / 1000;

    try {
      // 1. Toledo Prix (Ex: ST,GS,+000.450kg ou \x02000450\x03)
      if (protocolo.startsWith('TOLEDO')) {
        const matchGramos = rawFrame.match(/(\d{5,6})/);
        if (matchGramos) {
          const pesoBrutoKg = parseInt(matchGramos[1], 10) / 1000;
          return {
            pesoBrutoKg,
            taraKg,
            pesoLiquidoKg: Math.max(0, pesoBrutoKg - taraKg),
            estavel: !rawFrame.includes('US') && !rawFrame.includes('?'),
            timestamp: new Date(),
            rawFrame,
          };
        }
      }

      // 2. Filizola (Ex: \x0200450\x03 -> 450g)
      if (protocolo.startsWith('FILIZOLA')) {
        const limpo = rawFrame.replace(/[^\d]/g, '');
        if (limpo.length >= 5) {
          const pesoBrutoKg = parseInt(limpo.substring(0, 5), 10) / 1000;
          return {
            pesoBrutoKg,
            taraKg,
            pesoLiquidoKg: Math.max(0, pesoBrutoKg - taraKg),
            estavel: true,
            timestamp: new Date(),
            rawFrame,
          };
        }
      }

      // 3. Fallback / Regex Numérico Geral (Ex: "0.450" ou "450g" ou "0.450kg")
      const matchFloat = rawFrame.match(/([0-9]+\.?[0-9]*)/);
      if (matchFloat) {
        let val = parseFloat(matchFloat[1]);
        if (val > 50) val = val / 1000; // se for em gramas
        return {
          pesoBrutoKg: val,
          taraKg,
          pesoLiquidoKg: Math.max(0, val - taraKg),
          estavel: true,
          timestamp: new Date(),
          rawFrame,
        };
      }
    } catch (e) {
      console.warn('[BalancaEngine] Erro ao parsear frame:', rawFrame, e);
    }

    return null;
  }

  /**
   * Emulador interno para simulação e validação em ambiente de desenvolvimento
   */
  public iniciarEmulador(pesoSimuladoKg: number = 0.450) {
    if (this.emuladorInterval) clearInterval(this.emuladorInterval);

    const taraKg = (this.config.tara_padrao_g || 200) / 1000;

    this.emuladorInterval = setInterval(() => {
      // Simula pequena variação na balança
      const oscilacao = (Math.random() * 0.004 - 0.002);
      const pesoBrutoKg = Math.max(0, pesoSimuladoKg + oscilacao);
      this.notificar({
        pesoBrutoKg: Number(pesoBrutoKg.toFixed(3)),
        taraKg,
        pesoLiquidoKg: Number(Math.max(0, pesoBrutoKg - taraKg).toFixed(3)),
        estavel: true,
        timestamp: new Date(),
        rawFrame: `[EMULADOR] BRUTO:${pesoBrutoKg.toFixed(3)}kg TARA:${taraKg.toFixed(3)}kg`,
      });
    }, 1000);
  }

  public simularPeso(pesoKg: number) {
    if (this.config.modo_conexao === 'EMULADOR') {
      this.iniciarEmulador(pesoKg);
    }
  }
}

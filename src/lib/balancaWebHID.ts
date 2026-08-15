// Driver WebHID / WebSerial para leitura direta de balanças comerciais (Toledo, Filizola, Prix 3)
// Permite que o operador de caixa leia o peso fracionado em tempo real sem digitar manualmente

export interface BalancaLeitura {
  pesoKg: number;
  estavel: boolean;
  raw: string;
}

export async function conectarBalancaSerial(
  onLeitura: (leitura: BalancaLeitura) => void,
  onErro?: (erro: string) => void
): Promise<() => void> {
  if (!('serial' in navigator)) {
    if (onErro) onErro('A API WebSerial não é suportada por este navegador (use Chrome/Edge).');
    return () => {};
  }

  try {
    // Solcita seleção de porta serial (BaudRate padrão 9600 para balanças comerciais)
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });

    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable).catch(() => {});
    const reader = textDecoder.readable.getReader();

    let cancelado = false;

    const lerLoop = async () => {
      let buffer = '';
      while (!cancelado) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const linhas = buffer.split('\r\n');
          // Mantém o último fragmento no buffer
          buffer = linhas.pop() || '';

          for (const linha of linhas) {
            const limpa = linha.trim();
            // Padrão de peso comercial Toledo: ex: ST,GS,+00.380kg ou N00.380
            const matchPeso = limpa.match(/([0-9]+\.[0-9]{3})/);
            if (matchPeso) {
              const pesoVal = parseFloat(matchPeso[1]);
              const estavel = !limpa.includes('US') && !limpa.includes('?');
              onLeitura({ pesoKg: pesoVal, estavel, raw: limpa });
            }
          }
        }
      }
    };

    lerLoop().catch((err) => {
      if (onErro) onErro('Erro na leitura da balança: ' + err.message);
    });

    return () => {
      cancelado = true;
      reader.cancel().catch(() => {});
      port.close().catch(() => {});
    };
  } catch (err: any) {
    if (onErro) onErro('Erro ao abrir porta serial: ' + err.message);
    return () => {};
  }
}

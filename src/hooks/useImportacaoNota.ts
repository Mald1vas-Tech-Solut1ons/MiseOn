import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { interpretarEntradaNota } from '../lib/entradaNota';

/** Item como as duas rotas entregam — o formato que a conferência consome. */
export interface ItemLidoNota {
  num_item: number;
  descricao: string;
  gtin?: string | null;
  codigo_fornecedor?: string | null;
  qtd: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
}

/**
 * Nota pronta para conferência. É o contrato comum entre a consulta da SEFAZ e
 * a leitura por foto: as duas devolvem exatamente isto, e por isso o resto do
 * sistema não precisa saber de qual delas veio.
 */
export interface NotaLida {
  chave: string;
  uf: string;
  emitente: { razao_social: string; cnpj?: string | null };
  data_emissao?: string | null;
  /** O que foi efetivamente pago, com o desconto já abatido. */
  valor_total: number;
  /** Soma das linhas de produto, antes do desconto. */
  valor_produtos?: number;
  /** Desconto da nota inteira, rateado entre os itens no custo do estoque. */
  desconto?: number;
  itens: ItemLidoNota[];
  /** Presente quando veio da foto: identifica a origem na tela e nos logs. */
  origem?: string;
  ia_modelo?: string;
}

export interface ImportacaoNota {
  consultando: boolean;
  /** Texto do estado de espera — muda entre consultar a SEFAZ e ler a foto. */
  textoConsulta?: string;
  /** Motivo da última falha; não-nulo faz a tela oferecer a leitura por foto. */
  motivoFallback: string | null;
  /** Nota pronta para conferência, no formato comum às duas rotas. */
  dadosNota: NotaLida | null;
  processarQRCode: (entrada: string) => Promise<void>;
  processarFotoCupom: (fotosBase64: string[], mime: string) => Promise<void>;
  limparFalha: () => void;
  descartarNota: () => void;
}

/**
 * O caminho da nota fiscal até a tela de conferência, com as duas rotas.
 *
 * ─── POR QUE UM HOOK ──────────────────────────────────────────────────────
 * Estoque e Compras importavam nota com o mesmo código copiado, e a cópia já
 * tinha começado a divergir. Fluxo de aquisição de dados que vive em dois
 * lugares acaba corrigido em um só — e aí uma das telas volta a ser o beco sem
 * saída que a outra deixou de ser.
 *
 * ─── AS DUAS ROTAS ────────────────────────────────────────────────────────
 * 1. QR Code → consulta oficial da SEFAZ. É a melhor: dados assinados, EAN,
 *    CNPJ, valores exatos. Mas depende de portal no ar, do hash dentro do QR,
 *    e hoje só funciona em São Paulo.
 * 2. Foto do papel → leitura por IA. Não depende de portal nenhum, funciona em
 *    qualquer estado, e lê cupom amassado, apagado ou em contingência.
 *
 * A regra de ouro: falha na rota 1 NUNCA termina o fluxo. O lojista está com o
 * papel na mão e a lista de produtos está impressa nele — o sistema oferece a
 * rota 2 explicando o que houve, em vez de um alerta que fecha e não resolve.
 * As duas rotas devolvem o mesmo formato e caem no mesmo modal de conferência:
 * de onde o dado veio é problema nosso, não dele.
 */
export function useImportacaoNota(lojaId: string): ImportacaoNota {
  const [consultando, setConsultando] = useState(false);
  const [textoConsulta, setTextoConsulta] = useState<string | undefined>(undefined);
  const [motivoFallback, setMotivoFallback] = useState<string | null>(null);
  const [dadosNota, setDadosNota] = useState<NotaLida | null>(null);

  const processarQRCode = async (entrada: string) => {
    setConsultando(true);
    setTextoConsulta('Consultando nota na SEFAZ...');
    setMotivoFallback(null);
    try {
      // Tudo que o lojista cola ou digita passa por aqui: URL do QR inteira,
      // sem https, com %7C, só o "p=", ou a chave em blocos de quatro como vem
      // impressa. Antes o campo só sabia dizer "é URL ou não é", e 44 dígitos
      // digitados à mão viravam uma recusa seca.
      const leitura = interpretarEntradaNota(entrada);
      if (!leitura.podeConsultar) {
        setMotivoFallback(leitura.descricao);
        return;
      }

      const { data, error } = await supabase.functions.invoke('nfe-importar-qrcode', {
        body: { url_qrcode: leitura.url },
      });

      const msgErro = (data as { error?: string } | null)?.error;
      if (error || !data || msgErro) {
        setMotivoFallback(msgErro || error?.message || 'A SEFAZ não respondeu a consulta.');
        return;
      }
      setDadosNota(data as NotaLida);
    } catch (err) {
      setMotivoFallback(
        `Não consegui falar com a SEFAZ (${(err as Error)?.message ?? err}). ` +
        'Pode ser a conexão ou o portal fora do ar.',
      );
    } finally {
      setConsultando(false);
      setTextoConsulta(undefined);
    }
  };

  const processarFotoCupom = async (fotosBase64: string[], mime: string) => {
    setConsultando(true);
    setTextoConsulta('Lendo os itens do cupom...');
    try {
      const { data, error } = await supabase.functions.invoke('nfe-ocr-cupom', {
        body: { loja_id: lojaId, fotos_base64: fotosBase64, mime_type: mime },
      });

      const msgErro = (data as { error?: string } | null)?.error;
      if (error || !data || msgErro) {
        setMotivoFallback(msgErro || error?.message || 'Não consegui ler esse cupom.');
        return;
      }
      setMotivoFallback(null);
      setDadosNota(data as NotaLida);
    } catch (err) {
      setMotivoFallback(`Falha ao ler o cupom: ${(err as Error)?.message ?? err}`);
    } finally {
      setConsultando(false);
      setTextoConsulta(undefined);
    }
  };

  return {
    consultando,
    textoConsulta,
    motivoFallback,
    dadosNota,
    processarQRCode,
    processarFotoCupom,
    limparFalha: () => setMotivoFallback(null),
    descartarNota: () => setDadosNota(null),
  };
}

import { supabase } from './supabase';
import { zap } from '../components/landing/zap';

/**
 * Porta única de gravação de lead.
 *
 * Existia uma cópia do insert em cada formulário, e cada uma tinha o seu jeito
 * de errar em silêncio (medido em 17/09/2026: public.leads com ZERO linhas):
 *
 * - Contato.tsx gravava `nome_responsavel`, `nome_loja` e `observacao` —
 *   colunas que não existem em public.leads — e não mandava `nome`, que é
 *   NOT NULL. Todo envio falhava.
 * - KioskLeadForm oferecia "Cafeteria", "Food Hall" e "Rede / Franquia", que o
 *   CHECK de `segmento` recusa, e mostrava "Solicitação Recebida!" mesmo com o
 *   erro. O lead sumia e a pessoa achava que ia ser chamada.
 * - Loja.tsx mandava `segmento: null` para uma coluna NOT NULL.
 *
 * Regra daqui em diante: formulário não fala com a tabela, fala com
 * `registrarLead`. Se a gravação falhar, a tela oferece o WhatsApp com os
 * dados já escritos — o contato nunca se perde.
 */

/** Espelho do CHECK de public.leads.segmento. */
export const SEGMENTOS_ACEITOS = [
  'lanchonete',
  'hamburgueria',
  'restaurante',
  'pizzaria',
  'cozinha_industrial',
  'outro',
] as const;

export type SegmentoLead = (typeof SEGMENTOS_ACEITOS)[number];

/**
 * Converte qualquer segmento de formulário para um valor que o banco aceita.
 * O que não tem casa vira `outro`; o rótulo original vai para a mensagem, para
 * o comercial não perder a informação.
 */
export function normalizarSegmento(valor: string | null | undefined): SegmentoLead {
  const v = (valor ?? '').trim().toLowerCase();
  return (SEGMENTOS_ACEITOS as readonly string[]).includes(v) ? (v as SegmentoLead) : 'outro';
}

export interface DadosLead {
  nome: string;
  whatsapp: string;
  email?: string | null;
  segmento?: string | null;
  cidade?: string | null;
  mensagem?: string | null;
  origem: string;
}

/** Monta a linha exatamente como public.leads espera. */
export function linhaLead(d: DadosLead) {
  const segmento = normalizarSegmento(d.segmento);
  const original = (d.segmento ?? '').trim();
  const nota =
    original && segmento === 'outro' && original.toLowerCase() !== 'outro'
      ? `[segmento informado: ${original}] `
      : '';
  const mensagem = `${nota}${(d.mensagem ?? '').trim()}`.trim();

  return {
    nome: d.nome.trim(),
    whatsapp: d.whatsapp.trim(),
    email: d.email?.trim() || null,
    segmento,
    cidade: d.cidade?.trim() || null,
    mensagem: mensagem || null,
    origem: d.origem,
  };
}

/** Grava o lead. Devolve `true` só quando o banco confirmou. */
export async function registrarLead(d: DadosLead): Promise<boolean> {
  try {
    const { error } = await supabase.from('leads').insert(linhaLead(d));
    if (error) {
      console.warn('[leads] gravação recusada:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[leads] sem conexão com o banco:', e);
    return false;
  }
}

/** Link de WhatsApp com os dados do formulário — a saída quando o banco falha. */
export function whatsappDoLead(d: DadosLead): string {
  const partes = [
    'Olá! Tentei deixar meu contato no site do MiseOn e não foi.',
    `Nome: ${d.nome.trim()}`,
    `WhatsApp: ${d.whatsapp.trim()}`,
    d.segmento ? `Segmento: ${d.segmento}` : '',
    d.cidade ? `Cidade: ${d.cidade}` : '',
    d.mensagem ? `Mensagem: ${d.mensagem}` : '',
  ].filter(Boolean);
  return zap(partes.join('\n'));
}

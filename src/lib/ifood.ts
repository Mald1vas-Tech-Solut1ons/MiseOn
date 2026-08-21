import { supabase } from './supabase';

/**
 * Tudo que a tela precisa falar com o iFood, num lugar só.
 *
 * POR QUE ISTO EXISTE:
 * Os endpoints do ciclo de vida do pedido (cancelar, despachar, validar a
 * entrega) têm uma característica em comum que é fácil de errar em cada tela:
 * o iFood responde 202 "recebi" e decide DEPOIS. Chamar direto da tela leva a
 * dois enganos recorrentes —
 *
 *   1. tratar 2xx como "deu certo" e mudar o status local antes da hora;
 *   2. tratar `error` do supabase-js como a mensagem para o lojista, quando ele
 *      só diz "non-2xx" e esconde o motivo real no corpo.
 *
 * Aqui a resposta vira sempre a mesma forma: `{ ok, erro?, tecnico? }`. Quem
 * chama decide o que fazer, sem precisar saber de HTTP.
 *
 * A Edge Function `ifood-status` responde 200 mesmo em falha de negócio
 * justamente para o motivo chegar até aqui legível.
 */

export type RespostaIfood<T = Record<string, unknown>> = {
  ok: boolean;
  /** Mensagem pronta para mostrar ao lojista. */
  erro?: string;
  /** Detalhe cru, para o suporte. Nunca é a mensagem principal. */
  tecnico?: string;
  /**
   * A loja desligou esta sincronização nas preferências.
   *
   * NÃO é falha, e a diferença importa: quando o iFood recusa, a operação da
   * loja tem que parar para não divergir dos dois lados. Quando a própria loja
   * desligou o aviso, ela já decidiu tocar o iFood pelo Portal do Parceiro — e
   * travar o despacho local aqui seria o sistema impedindo a moto de sair por
   * causa de uma preferência do próprio dono.
   */
  desligado?: boolean;
} & Partial<T>;

async function chamar<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<RespostaIfood<T>> {
  const { data, error } = await supabase.functions.invoke('ifood-status', { body });

  // Os `as` existem porque o TypeScript não consegue provar que um objeto
  // literal satisfaz `Partial<T>` com T ainda genérico. O formato é garantido
  // pelo contrato da Edge Function, não pelo compilador.
  if (error) {
    return {
      ok: false,
      erro: 'Não deu para falar com o iFood agora. Tente de novo em instantes.',
      tecnico: error.message,
    } as RespostaIfood<T>;
  }
  if (!data?.ok) {
    return {
      ...data,
      ok: false,
      erro: data?.erro ?? data?.error ?? 'O iFood recusou a operação.',
      tecnico: data?.tecnico,
    } as RespostaIfood<T>;
  }
  return { ...data, ok: true } as RespostaIfood<T>;
}

export type MotivoIfood = { codigo: string; descricao: string };

/** Lista os motivos que o iFood aceita para ESTE pedido, agora. */
export function motivosDeCancelamento(pedidoId: string) {
  return chamar<{ motivos: MotivoIfood[]; origem: 'ifood' | 'padrao' }>({
    pedido_id: pedidoId,
    acao: 'motivos',
  });
}

/** Pede o cancelamento no iFood. Só depois de `ok` o MiseOn deve dar baixa. */
export function cancelarNoIfood(pedidoId: string, codigo: string) {
  return chamar<{ codigo: string; motivo: string }>({
    pedido_id: pedidoId,
    acao: 'cancelar',
    codigo,
  });
}

/** Avisa o iFood que o pedido saiu para entrega (entrega própria). */
export function despacharNoIfood(pedidoId: string) {
  return chamar<{ jaFeito: boolean }>({ pedido_id: pedidoId, acao: 'despachar' });
}

/**
 * Valida um código no iFood.
 *
 *   'coleta'  -> código que o entregador DO IFOOD mostra ao retirar na loja.
 *                Confere e libera a sacola; não encerra o pedido.
 *   'entrega' -> código do cliente na entrega própria ou na retirada no balcão.
 *                Este CONCLUI o pedido no iFood.
 */
export function validarCodigoIfood(pedidoId: string, tipo: 'coleta' | 'entrega', codigo: string) {
  return chamar<{ codigoInvalido: boolean }>({
    pedido_id: pedidoId,
    acao: tipo === 'coleta' ? 'validar_coleta' : 'validar_entrega',
    codigo,
  });
}

/** O pedido veio do iFood e tem um id lá do outro lado para conversar. */
export function ehPedidoIfood(p: { origem?: string; ifood_order_id?: string | null }) {
  return p.origem === 'ifood' && !!p.ifood_order_id;
}

/**
 * Quem entrega este pedido.
 *
 * Só a entrega PRÓPRIA passa por /dispatch e por código de entrega. Quando o
 * iFood entrega, o despacho e a conclusão são do entregador deles — e chamar os
 * endpoints da loja nesse caso volta recusado.
 */
export function entregaEhDaLoja(p: { ifood_entregue_por?: string | null }) {
  return p.ifood_entregue_por !== 'IFOOD';
}

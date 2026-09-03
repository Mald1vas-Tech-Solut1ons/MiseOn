import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

/** Tipos de alertas financeiros monitorados em tempo real */
export type TipoAlertaLedger =
  | 'ESTOQUE_INSUFICIENTE'
  | 'ESTORNO_SUSPEITO'
  | 'WEBHOOK_HMAC_REJEITADO'
  | 'LANCAMENTO_DUPLICADO'
  | 'SEQUENCIA_PEDIDO_ERRO';

export interface AlertaLedger {
  tipo: TipoAlertaLedger;
  mensagem: string;
  pedido_id?: string;
  numero_pedido?: number;
  valor?: number;
  timestamp: string;
}

interface UseLedgerAlertsOptions {
  lojaId: string;
  /** Callback customizado chamado a cada alerta recebido */
  onAlerta?: (alerta: AlertaLedger) => void;
  /** Habilitar toast automático (padrão: true) */
  toastAutomatico?: boolean;
}

/**
 * Hook de monitoramento financeiro em tempo real (Supabase Realtime).
 *
 * Escuta 3 canais simultâneos:
 *  1. `lancamentos_financeiros` — detecta lançamentos com referencia_tipo = ESTORNO
 *     suspeitos (cancelamento tardio, valores inesperados).
 *  2. `pedidos` — detecta transições de status que indicam falha de estoque
 *     (pedido vai para CANCELADO logo após ACEITO sem baixa de estoque).
 *  3. Canal de broadcast `webhook-erros-{lojaId}` — recebe sinais das Edge Functions
 *     quando um HMAC é rejeitado ou um pagamento Pix não é encontrado.
 *
 * Uso:
 * ```tsx
 * useLedgerAlerts({ lojaId, onAlerta: (a) => console.warn(a) });
 * ```
 */
export function useLedgerAlerts({
  lojaId,
  onAlerta,
  toastAutomatico = true,
}: UseLedgerAlertsOptions) {
  const toast = useToast();
  const canaisRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  const dispararAlerta = useCallback((alerta: AlertaLedger) => {
    onAlerta?.(alerta);

    if (!toastAutomatico) return;

    const prefixo: Record<TipoAlertaLedger, string> = {
      ESTOQUE_INSUFICIENTE:    '🚨 Estoque insuficiente',
      ESTORNO_SUSPEITO:        '⚠️  Estorno suspeito',
      WEBHOOK_HMAC_REJEITADO:  '🔒 Webhook rejeitado',
      LANCAMENTO_DUPLICADO:    '⚠️  Lançamento duplicado',
      SEQUENCIA_PEDIDO_ERRO:   '🔢 Erro de sequência',
    };

    toast(`${prefixo[alerta.tipo]}: ${alerta.mensagem}`, 'erro');
  }, [onAlerta, toast, toastAutomatico]);

  useEffect(() => {
    if (!lojaId) return;

    // ── Canal 1: Monitoramento de Estornos Suspeitos ──────────────────────────
    // Um estorno logo após finalização (< 60 segundos) pode indicar fraude ou bug.
    const canalEstornos = supabase
      .channel(`ledger-estornos-${lojaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lancamentos_financeiros',
          filter: `loja_id=eq.${lojaId}`,
        },
        (payload) => {
          const lancamento = payload.new as {
            referencia_tipo: string;
            valor: number;
            historico: string;
            referencia_id: string;
            criado_em: string;
          };

          if (lancamento.referencia_tipo === 'ESTORNO') {
            dispararAlerta({
              tipo: 'ESTORNO_SUSPEITO',
              mensagem: lancamento.historico,
              valor: lancamento.valor,
              pedido_id: lancamento.referencia_id,
              timestamp: lancamento.criado_em,
            });
          }
        }
      )
      .subscribe();

    // ── Canal 2: Pedidos cancelados com estoque já baixado ────────────────────
    // Indica que a cozinha iniciou o preparo mas a venda foi perdida.
    const canalPedidos = supabase
      .channel(`ledger-pedidos-${lojaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `loja_id=eq.${lojaId}`,
        },
        (payload) => {
          const pedido = payload.new as {
            id: string;
            numero: number;
            status: string;
            estoque_baixado: boolean;
            valor_total: number;
            criado_em: string;
          };
          const anterior = payload.old as { status: string };

          // Detecta cancelamento com estoque já comprometido
          if (
            pedido.status === 'CANCELADO' &&
            pedido.estoque_baixado &&
            anterior.status !== 'CANCELADO'
          ) {
            dispararAlerta({
              tipo: 'ESTOQUE_INSUFICIENTE',
              mensagem: `Pedido #${pedido.numero} cancelado com estoque já comprometido. Verifique o inventário.`,
              pedido_id: pedido.id,
              numero_pedido: pedido.numero,
              valor: pedido.valor_total,
              timestamp: new Date().toISOString(),
            });
          }
        }
      )
      .subscribe();

    // ── Canal 3: Broadcast de erros de webhook das Edge Functions ─────────────
    // As Edge Functions (pix-webhook, ifood-webhook) enviam eventos para este canal
    // quando detectam HMAC inválido ou pedido não encontrado.
    const canalWebhook = supabase
      .channel(`webhook-erros-${lojaId}`)
      .on(
        'broadcast',
        { event: 'webhook_error' },
        (payload) => {
          const data = payload.payload as {
            tipo: TipoAlertaLedger;
            mensagem: string;
            timestamp: string;
          };
          dispararAlerta({
            tipo: data.tipo ?? 'WEBHOOK_HMAC_REJEITADO',
            mensagem: data.mensagem ?? 'Erro desconhecido no webhook',
            timestamp: data.timestamp ?? new Date().toISOString(),
          });
        }
      )
      .subscribe();

    canaisRef.current = [canalEstornos, canalPedidos, canalWebhook];

    return () => {
      canaisRef.current.forEach((c) => supabase.removeChannel(c));
      canaisRef.current = [];
    };
  }, [lojaId, dispararAlerta]);
}

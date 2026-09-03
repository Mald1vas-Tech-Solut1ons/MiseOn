import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { tocarSom } from '../lib/som';
import { Pedido } from '../types';

type NotificationContext = 'PDV' | 'PAINEL' | 'ENTREGAS' | 'ROTA' | 'CLIENTE';

interface UseRealtimeNotificationsProps {
  lojaId?: string;
  pedidoId?: string; // Usado no CLIENTE
  contexto: NotificationContext;
  entregadorId?: string; // Usado na ROTA
  modoPdv?: 'BALCAO' | 'MESA'; // Usado no PDV
}

export function useRealtimeNotifications({ lojaId, pedidoId, contexto, entregadorId, modoPdv }: UseRealtimeNotificationsProps) {
  const toast = useToast();

  useEffect(() => {
    // Para contextos de loja, precisamos de lojaId
    if ((contexto === 'PDV' || contexto === 'PAINEL' || contexto === 'ENTREGAS') && !lojaId) return;

    // Canais e filtros
    const canais: ReturnType<typeof supabase.channel>[] = [];

    // Contexto Cliente: Assina alterações de um pedido específico
    if (contexto === 'CLIENTE' && pedidoId) {
      const canalCliente = supabase.channel(`realtime-cliente-${pedidoId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedidoId}` }, () => {
          // A notificação em si já é tratada dentro do Pedido.tsx via notificarMudanca(payload.new),
          // mas se futuramente quisermos migrar o toast para cá, podemos. Por enquanto,
          // o Pedido.tsx já faz isso de forma perfeita. Deixaremos o hook pronto.
        })
        .subscribe();
      canais.push(canalCliente);
      return () => {
        canais.forEach(c => supabase.removeChannel(c));
      };
    }

    if (lojaId) {
      const canalLoja = supabase.channel(`realtime-loja-${lojaId}-${contexto}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, (payload) => {
          const p = payload.new as Pedido;
          if (contexto === 'PDV' && modoPdv === 'MESA' && p.origem !== 'balcao' && p.origem !== 'garcom') {
            // Novo pedido de mesa via QR ou delivery (não feito pelo próprio PDV)
            toast(`Novo pedido #${p.numero}!`, 'info');
            tocarSom();
          } else if (contexto === 'ENTREGAS' && p.tipo_pedido === 'DELIVERY') {
            const contextoAgendado = p.agendado_para ? ' AGENDADO' : '';
            toast(`Novo delivery${contextoAgendado} #${p.numero}!`, 'info');
            tocarSom();
          }
          // Painel já tem seu próprio som/notificação de desktop, se quisermos unificar, fazemos aqui, mas o requisito diz: "Para PainelPedidos (já existe): mantemos o atual."
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, (payload) => {
          const novo = payload.new as Pedido;
          const velho = payload.old as Pedido;
          
          if (velho.status !== 'PRONTO' && novo.status === 'PRONTO') {
            if (contexto === 'PDV') {
              if (novo.tipo_pedido === 'SALAO') {
                toast(`Pedido #${novo.numero} PRONTO para servir na Mesa ${novo.mesa_numero || ''}!`, 'sucesso');
              } else if (novo.tipo_pedido === 'DELIVERY') {
                toast(`Delivery #${novo.numero} PRONTO para entrega!`, 'sucesso');
              } else {
                toast(novo.agendado_para ? `Agendamento #${novo.numero} PRONTO para retirada!` : `Pedido #${novo.numero} PRONTO para retirada!`, 'sucesso');
              }
              tocarSom();
            } else if (contexto === 'ENTREGAS' && novo.tipo_pedido === 'DELIVERY') {
              toast(`Delivery #${novo.numero} PRONTO para despacho!`, 'sucesso');
              tocarSom();
            }
          }
        })
        .subscribe();
      canais.push(canalLoja);
    }

    if (contexto === 'ROTA' && entregadorId) {
      // Para o entregador na rota, queremos saber se um pedido da sua rota ficou pronto
      const canalEntregador = supabase.channel(`realtime-entregador-${entregadorId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `entregador_id=eq.${entregadorId}` }, (payload) => {
          const novo = payload.new as Pedido;
          const velho = payload.old as Pedido;
          if (velho.status !== 'PRONTO' && novo.status === 'PRONTO') {
            toast(`Sua entrega #${novo.numero} está pronta na loja!`, 'sucesso');
            tocarSom();
          }
        })
        .subscribe();
      canais.push(canalEntregador);
    }

    // Chat e Assistente IA NÃO são tratados aqui de propósito.
    // O canal `admin-alerts-{loja}` é assinado pelo useNotificationStore, que
    // faz sino + toast + som + notificação de desktop num lugar só. Ter dois
    // canais com o MESMO nome no mesmo client fazia só um deles receber os
    // eventos — a notificação aparecia no sino e o som nunca tocava.

    return () => {
      canais.forEach(c => supabase.removeChannel(c));
    };
  }, [lojaId, pedidoId, contexto, entregadorId, modoPdv, toast]);
}

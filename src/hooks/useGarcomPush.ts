import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ChamadoGarcom } from '../types';

export function useGarcomPush(lojaId?: string | null) {
  const [chamadosPendentes, setChamadosPendentes] = useState<ChamadoGarcom[]>([]);
  const [pushHabilitado, setPushHabilitado] = useState(false);

  useEffect(() => {
    if (!lojaId) return;

    // Verificar se Notification API está presente no navegador
    if ('Notification' in window && Notification.permission === 'granted') {
      setPushHabilitado(true);
    }

    // Carregar chamados pendentes
    const carregarChamados = async () => {
      const { data } = await supabase
        .from('chamados_garcom')
        .select('*, mesas(numero)')
        .eq('loja_id', lojaId)
        .eq('status', 'PENDENTE')
        .order('criado_em', { ascending: false });

      if (data) {
        setChamadosPendentes(
          data.map((c: any) => ({
            ...c,
            mesa_numero: c.mesas?.numero,
          }))
        );
      }
    };

    carregarChamados();

    // Inscrever em canal Realtime do Supabase (Chamados + Pratos Prontos na Cozinha/Bar)
    const canal = supabase
      .channel(`garcom-chamados-${lojaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chamados_garcom', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          const novo = payload.new as ChamadoGarcom;
          dispararAlertaHapticoESonoro(novo);
          carregarChamados();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chamados_garcom', filter: `loja_id=eq.${lojaId}` },
        () => carregarChamados()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          const ped = payload.new as any;
          if (ped.status === 'PRONTO') {
            dispararAlertaPratoPronto(ped);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [lojaId]);

  const dispararAlertaHapticoESonoro = (chamado: ChamadoGarcom) => {
    // 1. Web Vibration API (Vibração no Smartphone do Garçom)
    if ('vibrate' in navigator) {
      try {
        const padrao = chamado.tipo === 'FECHAMENTO' ? [300, 100, 300, 100, 500] : [200, 100, 200];
        navigator.vibrate(padrao);
      } catch (e) {
        console.warn('Vibração não permitida ou desabilitada pelo dispositivo:', e);
      }
    }

    // 2. Notificação Visual Browser / Push Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const titulo = chamado.tipo === 'FECHAMENTO' ? '💳 Solicitação de Fechamento!' : '🔔 Chamado de Atendimento!';
      const msg = `Mesa #${chamado.mesa_numero || 'Salão'} solicita ${chamado.tipo === 'FECHAMENTO' ? 'a conta / fechamento' : 'garçom na mesa'}.`;
      new Notification(titulo, {
        body: msg,
        icon: '/icon.png',
        tag: `chamado-${chamado.id}`,
      });
    }

    // 3. Sinal Sonoro de Alerta (Audio API)
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // nota A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // AudioContext pode ser bloqueado sem gesto prévio do usuário
    }
  };

  const dispararAlertaPratoPronto = (pedido: any) => {
    // Vibração tripla de confirmação no celular do garçom
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 150, 80, 300]);
      } catch {
        // Vibração indisponível no navegador
      }
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const mesa = pedido.mesa_numero ? `Mesa #${pedido.mesa_numero}` : pedido.identificador_cliente || 'Salão';
      new Notification('🍳 Prato / Drink Pronto!', {
        body: `Pedido #${pedido.numero} (${mesa}) está PRONTO para ser servido!`,
        icon: '/icon.png',
        tag: `pronto-${pedido.id}`,
      });
    }
  };

  const solicitarPermissaoPush = async () => {
    if (!('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setPushHabilitado(true);

      // Registrar Service Worker se disponível
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js');
        } catch (e) {
          console.warn('Erro ao registrar Service Worker:', e);
        }
      }
      return true;
    }
    return false;
  };

  const atenderChamado = async (chamadoId: string) => {
    const { data: userRes } = await supabase.auth.getUser();
    await supabase
      .from('chamados_garcom')
      .update({
        status: 'EM_ATENDIMENTO',
        atendido_por: userRes.user?.id || null,
        atendido_em: new Date().toISOString(),
      })
      .eq('id', chamadoId);
  };

  const concluirChamado = async (chamadoId: string) => {
    await supabase
      .from('chamados_garcom')
      .update({
        status: 'CONCLUIDO',
      })
      .eq('id', chamadoId);
  };

  return {
    chamadosPendentes,
    pushHabilitado,
    solicitarPermissaoPush,
    atenderChamado,
    concluirChamado,
    dispararAlertaHapticoESonoro,
  };
}

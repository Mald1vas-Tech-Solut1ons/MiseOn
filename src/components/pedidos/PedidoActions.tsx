import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Bike, Check, X as XIcon, Store, ChefHat, Receipt, UtensilsCrossed, Flame, Lock, FileText, Loader2 } from 'lucide-react';
import type { PedidoActionsProps } from '../../types';
import { supabase } from '../../lib/supabase';

import { useI18n } from '../../contexts/I18nContext';
export function PedidoActions({
  pedido: p, papel, naCozinha, precisaConferir, todosConferidos, semAvancoSalao,
  destinoStatus, destinoLabel, isDelivery, processando, fluxoProx, fluxoLabel,
  onAvancar, onEnviarCozinha, onCancelar, onConferirColeta, onImprimir, executar,
}: PedidoActionsProps) {
  const { tDynamic } = useI18n();
  const [menu, setMenu] = useState(false);
  const [emitindoNfe, setEmitindoNfe] = useState(false);
  const [posicaoMenu, setPosicaoMenu] = useState<{ top: number; right: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  // O card do pedido tem overflow-hidden (cantos arredondados) — um dropdown
  // `position: absolute` dentro dele fica cortado/inacessível. Por isso o menu
  // sai da árvore via portal, com posição calculada a partir do botão real.
  useLayoutEffect(() => {
    if (!menu || !botaoRef.current) { setPosicaoMenu(null); return; }
    const calcular = () => {
      const r = botaoRef.current!.getBoundingClientRect();
      setPosicaoMenu({ top: window.innerHeight - r.top + 8, right: window.innerWidth - r.right });
    };
    calcular();
    window.addEventListener('resize', calcular);
    window.addEventListener('scroll', calcular, true);
    return () => {
      window.removeEventListener('resize', calcular);
      window.removeEventListener('scroll', calcular, true);
    };
  }, [menu]);

  const handleEmitirNfe = async () => {
    setMenu(false);
    if (p.nfe_url) {
      window.open(p.nfe_url, '_blank');
      return;
    }
    
    setEmitindoNfe(true);
    try {
      const { error, data } = await supabase.functions.invoke('fiscal-emitir-nfce', {
        body: { pedido_id: p.id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        alert('NFC-e enviada, aguardando Sefaz.');
      }
    } catch (err: any) {
      alert('Erro ao emitir NFC-e: ' + (err.message || String(err)));
    }
    setEmitindoNfe(false);
  };

  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (botaoRef.current?.contains(alvo)) return;
      if (menuPortalRef.current?.contains(alvo)) return;
      setMenu(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [menu]);

  return (
    <div className="p-4 flex gap-2 border-t border-gray-100 dark:border-white/5">
      {/* NOVO → ACEITO */}
      {p.status === 'NOVO' && (
        <button type="button" disabled={processando} onClick={() => executar(() => onAvancar('ACEITO'))}
          className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white rounded-xl py-2.5 font-['Sora'] font-bold text-sm shadow-lg shadow-orange-500/20 hover:brightness-110 transition disabled:opacity-50">
          <Check size={16} /> Aceitar pedido
        </button>
      )}

      {/* ACEITO com bastão no balcão: enviar pra cozinha OU consumo salão/comanda OU atalho de revenda */}
      {p.status === 'ACEITO' && !naCozinha && (
        p.requer_cozinha ? (
          <button type="button" disabled={processando} onClick={() => executar(onEnviarCozinha)}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white rounded-xl py-2.5 font-['Sora'] font-bold text-sm shadow-lg shadow-orange-500/20 hover:brightness-110 transition disabled:opacity-50">
            <Flame size={16} /> {tDynamic('Enviar para a cozinha')}
          </button>
        ) : (p.tipo_pedido === 'SALAO' || p.origem === 'balanca') ? (
          <div className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <UtensilsCrossed size={15} /> {tDynamic('Consumo Salão (Comanda Aberta)')}
          </div>
        ) : (
          <button type="button" disabled={processando} onClick={() => executar(() => onAvancar('PRONTO'))}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-xl py-2.5 font-['Sora'] font-bold text-sm shadow-lg shadow-emerald-500/20 hover:brightness-110 transition disabled:opacity-50">
            <Store size={16} /> Separar e entregar
          </button>
        )
      )}

      {/* Bastão com a cozinha: sem ação no balcão */}
      {naCozinha && (
        <div className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-xs font-bold uppercase tracking-wide text-orange-600 dark:border-orange-900/40 dark:bg-orange-900/10 dark:text-orange-400">
          <ChefHat size={14} /> Aguardando a cozinha
        </div>
      )}

      {/* PRONTO com bastão no balcão: conferência antes do destino */}
      {precisaConferir && (
        <button type="button" disabled={processando || !todosConferidos} onClick={() => executar(() => onAvancar(destinoStatus))}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-xl py-2.5 font-['Sora'] font-bold text-sm shadow-lg shadow-emerald-500/20 hover:brightness-110 transition disabled:cursor-not-allowed disabled:opacity-40">
          <Check size={16} /> {destinoLabel}
        </button>
      )}

      {/* EM_ROTA → FINALIZADO (segue igual) */}
      {p.status === 'EM_ROTA' && fluxoProx && (
        <button type="button" disabled={processando} onClick={() => executar(() => onAvancar(fluxoProx))}
          className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white rounded-xl py-2.5 font-['Sora'] font-bold text-sm shadow-lg shadow-orange-500/20 hover:brightness-110 transition disabled:opacity-50">
          <Check size={16} /> {fluxoLabel}
        </button>
      )}

      {/* Entrega do iFood: quem leva é o entregador deles, então o balcão não
          despacha — só confere o código dele antes de soltar a sacola. */}
      {onConferirColeta && (
        <button type="button"
          disabled={processando}
          onClick={onConferirColeta}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 font-['Sora'] text-sm font-bold text-blue-600 transition hover:bg-blue-500/20 disabled:opacity-50 dark:text-blue-400"
        >
          <Bike size={16} /> {tDynamic('Conferir entregador')}
        </button>
      )}

      {semAvancoSalao && (
        <div className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 py-2.5 text-xs font-bold uppercase tracking-wide text-purple-600 dark:border-purple-900/40 dark:bg-purple-900/10 dark:text-purple-400">
          <UtensilsCrossed size={14} /> Aguardando fechar a conta
        </div>
      )}

      <div className="relative">
        <button type="button"
          ref={botaoRef}
          onClick={() => setMenu((m) => !m)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition"
          title="Imprimir via"
        >
          <Printer size={18} />
        </button>
        {menu && posicaoMenu && createPortal(
          <div
            ref={menuPortalRef}
            style={{ position: 'fixed', bottom: posicaoMenu.top, right: posicaoMenu.right }}
            className="z-[100] w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0B1120]"
          >
            <p className="px-3 pt-2.5 pb-1 text-xs opacity-90 font-bold uppercase tracking-wider text-gray-400">Imprimir via</p>
            <button type="button" onClick={() => { setMenu(false); onImprimir('cozinha'); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5">
              <ChefHat size={16} className="text-orange-500" /> {tDynamic('Comanda da Cozinha')}
            </button>
            {isDelivery && (
              <button type="button" onClick={() => { setMenu(false); onImprimir('romaneio'); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5">
                <Bike size={16} className="text-blue-500" /> {tDynamic('Romaneio do Entregador')}
              </button>
            )}
            <button type="button" onClick={() => { setMenu(false); onImprimir('nota'); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5">
              <Receipt size={16} className="text-emerald-500" /> {tDynamic('Nota do Cliente')}
            </button>
            <div className="my-1 border-t border-gray-100 dark:border-white/5"></div>
            <button type="button"
              onClick={handleEmitirNfe}
              disabled={emitindoNfe}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5 disabled:opacity-50"
            >
              {emitindoNfe ? <Loader2 size={16} className="text-blue-500 animate-spin" /> : <FileText size={16} className="text-blue-500" />}
              {p.nfe_url ? 'Imprimir DANFE (NFC-e)' : 'Emitir NFC-e'}
            </button>
          </div>,
          document.body
        )}
      </div>

      {['NOVO','ACEITO','PREPARANDO'].includes(p.status) && (naCozinha || p.status === 'PREPARANDO' ? papel === 'admin' : true) && (
        <button type="button"
          onClick={onCancelar}
          title={naCozinha || p.status === 'PREPARANDO' ? 'A cozinha já começou — só admin cancela' : 'Cancelar pedido'}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition"
        >
          {(naCozinha || p.status === 'PREPARANDO') ? <Lock size={15} /> : <XIcon size={18} />}
        </button>
      )}
    </div>
  );
}

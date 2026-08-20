import { Bike, Store, UtensilsCrossed } from 'lucide-react';
import { fmt } from '../../types';
import type { PedidoFooterProps } from '../../types';

import { useI18n } from '../../contexts/I18nContext';
export function PedidoFooter({ pedido: p }: PedidoFooterProps) {
  const { tDynamic } = useI18n();
  return (
    <>
      {/* ── Entrega/Balcão/Mesa ── */}
      <div className="mx-4 border-t border-gray-100 py-2.5 dark:border-white/5">
        {p.tipo_pedido === 'DELIVERY' ? (
          <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#AEB9CE]">
            <Bike size={14} className="mt-0.5 shrink-0 text-blue-500 dark:text-[#6B9EFF]" />
            <span>{p.endereco_entrega}{p.bairro ? ` — ${p.bairro}` : ''}</span>
          </div>
        ) : p.tipo_pedido === 'SALAO' ? (
          <div className="flex items-center gap-1.5 font-semibold text-purple-500">
            <UtensilsCrossed size={14} /> Mesa {p.mesa_numero ?? '—'}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-500 font-semibold">
            <Store size={14} /> {tDynamic('Retirada no balcão')}
          </div>
        )}
      </div>

      {p.origem === 'ifood' ? (
        <div className="px-4 py-3 border-t border-gray-100 bg-red-50/50 dark:border-red-900/20 dark:bg-red-900/5">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Bruto iFood</span>
            <span>{fmt(Number(p.valor_bruto_ifood || p.valor_total))}</span>
          </div>
          <div className="flex justify-between text-xs font-medium text-red-500 mb-2">
            <span>Taxa Retida (iFood)</span>
            <span>-{fmt(Number(p.taxa_ifood_retida || 0))}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-red-100 dark:border-red-900/30">
            <span className="font-['Sora'] font-bold text-[15px] text-gray-900 dark:text-gray-100">Líquido (Loja)</span>
            <span className="font-['Sora'] font-black text-[15px] text-emerald-600 dark:text-emerald-400">
              {fmt(Number(p.valor_total) - Number(p.taxa_ifood_retida || 0))}
            </span>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 flex justify-between border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
          <span className="font-['Sora'] font-bold text-[15px] text-gray-900 dark:text-gray-100">Total</span>
          <span className="font-['Sora'] font-bold text-[15px] text-orange-500">{fmt(Number(p.valor_total))}</span>
        </div>
      )}
    </>
  );
}

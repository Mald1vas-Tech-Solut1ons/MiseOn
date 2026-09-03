import { Check } from 'lucide-react';
import { fmt } from '../../types';
import type { PedidoItensProps } from '../../types';

export function PedidoItens({ pedido: p, precisaConferir, conferidos, toggleConferido }: PedidoItensProps) {
  const itens = p.itens_pedido ?? [];

  return (
    <>
      {/* ── Itens (com checklist de conferência quando aplicável) ── */}
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        {itens.map((i) => (
          <div key={i.id} className={`flex justify-between text-[13px] ${precisaConferir ? 'cursor-pointer select-none' : ''}`}
            onClick={() => precisaConferir && toggleConferido(i.id)}>
            <span className="flex items-start gap-2 text-gray-700 dark:text-[#AEB9CE]">
              {precisaConferir && (
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${conferidos.has(i.id) ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 dark:border-gray-600'}`}>
                  {conferidos.has(i.id) && <Check size={11} className="text-white" />}
                </span>
              )}
              <span>
                {i.quantidade}× {i.nome_produto}
                {i.itens_pedido_opcoes?.map((o, x) => (
                  <span key={x} className="mt-0.5 block text-xs opacity-95 text-gray-500 dark:text-[#6C7A96]">+ {o.nome_opcao}</span>
                ))}
                {i.observacao && (
                  <span className="mt-0.5 block text-xs opacity-95 font-semibold text-red-500 dark:text-red-400">⚠ {i.observacao}</span>
                )}
              </span>
            </span>
            <span className="ml-2 whitespace-nowrap font-['Sora'] font-semibold text-gray-900 dark:text-[#EAF1FB]">
              {fmt(Number(i.preco_unitario) * i.quantidade)}
            </span>
          </div>
        ))}
      </div>

      {precisaConferir && itens.length > 0 && (
        <div className="mx-4 mb-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(conferidos.size / itens.length) * 100}%` }} />
          </div>
          <span className="shrink-0 text-xs opacity-90 font-bold text-gray-400">{conferidos.size}/{itens.length}</span>
        </div>
      )}
    </>
  );
}

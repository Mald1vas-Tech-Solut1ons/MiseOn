import { X, Banknote, QrCode, CreditCard, Loader2, Check } from 'lucide-react';
import { fmt } from '../../types';
import type { PaymentModalProps, MetodoPgto } from '../../types';
import { useI18n } from '../../contexts/I18nContext';

const NOTAS_RAPIDAS = [5, 10, 20, 50, 100, 200];

export function PaymentModal({
  total, metodo, setMetodo, setErro, valorRecebido, setValorRecebido,
  recebidoNum, troco, erro, processando, registrarVenda, setEtapa
}: PaymentModalProps) {
  const { tDynamic } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !processando && setEtapa('CARRINHO')}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-black dark:text-gray-100">{tDynamic('Receber')} {fmt(total)}</h3>
          <button onClick={() => setEtapa('CARRINHO')} className="text-gray-400"><X size={20} /></button>
        </div>
        <p className="mb-4 text-xs text-gray-500">{tDynamic('Como o cliente vai pagar?')}</p>

        <div className="grid grid-cols-2 gap-2">
          {([
            { m: 'DINHEIRO' as MetodoPgto, label: tDynamic('Dinheiro'), icon: <Banknote size={20} /> },
            { m: 'PIX' as MetodoPgto, label: tDynamic('Pix (QR na tela)'), icon: <QrCode size={20} /> },
            { m: 'CREDITO' as MetodoPgto, label: tDynamic('Crédito (maquininha)'), icon: <CreditCard size={20} /> },
            { m: 'DEBITO' as MetodoPgto, label: tDynamic('Débito (maquininha)'), icon: <CreditCard size={20} /> },
          ]).map((op) => (
            <button key={op.m} onClick={() => { setMetodo(op.m); setErro(''); }}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 text-sm font-bold transition ${metodo === op.m ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria)]' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>
              {op.icon}{op.label}
            </button>
          ))}
        </div>

        {metodo === 'DINHEIRO' && (
          <div className="mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300">{tDynamic('Quanto o cliente entregou?')}</label>
            <input 
              value={valorRecebido} 
              onChange={(e) => {
                const value = e.target.value;
                if (value.startsWith('-')) {
                  setErro(tDynamic('Valor não pode ser negativo'));
                  return;
                }
                const clean = value.replace(/[^\d,]/g, '').replace(/,+/g, ',');
                const parts = clean.split(',');
                if (parts[1] && parts[1].length > 2) {
                  setValorRecebido(parts[0] + ',' + parts[1].slice(0, 2));
                } else {
                  setValorRecebido(clean);
                }
              }}
              placeholder="0,00" 
              autoFocus
              className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-center text-2xl font-black outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" 
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => setValorRecebido(String(total))} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-bold text-gray-600 dark:border-gray-600 dark:text-gray-300">{tDynamic('Valor exato')}</button>
              {NOTAS_RAPIDAS.filter((n) => n >= total).slice(0, 3).map((n) => (
                <button key={n} onClick={() => setValorRecebido(String(n))} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-bold text-gray-600 dark:border-gray-600 dark:text-gray-300">R$ {n}</button>
              ))}
            </div>
            {metodo === 'DINHEIRO' && recebidoNum >= total && (
              <p className="mt-3 text-center text-sm font-bold text-gray-600 dark:text-gray-300">
                {tDynamic('Troco:')} <span className="text-xl font-black text-emerald-600">{fmt(troco)}</span>
              </p>
            )}
          </div>
        )}

        {erro && <p className="mt-3 text-center text-sm font-semibold text-red-500">{erro}</p>}

        <button disabled={!metodo || processando || (metodo === 'DINHEIRO' && recebidoNum < total)}
          onClick={() => metodo && registrarVenda(metodo)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white shadow-lg disabled:opacity-40">
          {processando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {processando ? tDynamic('Registrando…') : metodo === 'PIX' ? tDynamic('Gerar QR Code Pix') : tDynamic('Confirmar recebimento')}
        </button>
      </div>
    </div>
  );
}

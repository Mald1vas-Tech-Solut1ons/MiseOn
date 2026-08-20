import { fmt } from '../../types';
import type { CaixaModalProps } from '../../types';

import { useI18n } from '../../contexts/I18nContext';
export function CaixaModal({
  modalCaixa, setModalCaixa, salvandoCaixa, valorCaixa, setValorCaixa,
  motivoCaixa, setMotivoCaixa, obsFechamento, setObsFechamento,
  turno, dinheiroTurno, reforcos, sangrias, dinheiroGaveta,
  abrirTurno, registrarMov, fecharTurno
}: CaixaModalProps) {
  const { tDynamic } = useI18n();
  const inputCls = 'w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

  if (!modalCaixa) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !salvandoCaixa && setModalCaixa(null)}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        {modalCaixa === 'ABRIR' && (
          <>
            <h3 className="text-lg font-black dark:text-gray-100">Abrir o caixa</h3>
            <p className="mb-4 mt-1 text-xs text-gray-500">{tDynamic('Conte o dinheiro que está na gaveta para começar o turno (fundo de troco).')}</p>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300">{tDynamic('Fundo de troco (R$)')}</label>
            <input value={valorCaixa} onChange={(e) => {
              const value = e.target.value;
              if (value.startsWith('-')) return;
              const clean = value.replace(/[^\d,]/g, '').replace(/,+/g, ',');
              const parts = clean.split(',');
              if (parts[1] && parts[1].length > 2) {
                setValorCaixa(parts[0] + ',' + parts[1].slice(0, 2));
              } else {
                setValorCaixa(clean);
              }
            }} placeholder="0,00" inputMode="decimal" autoFocus className={`${inputCls} mt-1 text-center text-xl font-black`} />
            <button onClick={abrirTurno} disabled={salvandoCaixa} className="mt-4 w-full rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-50">
              {salvandoCaixa ? 'Abrindo…' : 'Abrir caixa'}
            </button>
          </>
        )}
        {(modalCaixa === 'SANGRIA' || modalCaixa === 'REFORCO') && (
          <>
            <h3 className="text-lg font-black dark:text-gray-100">{modalCaixa === 'SANGRIA' ? 'Sangria (retirar dinheiro)' : 'Reforço (colocar troco)'}</h3>
            <p className="mb-4 mt-1 text-xs text-gray-500">{modalCaixa === 'SANGRIA' ? 'Retirada de dinheiro da gaveta (ex: levar para o cofre).' : 'Entrada de dinheiro na gaveta (ex: buscar mais troco).'}</p>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Valor (R$)</label>
            <input value={valorCaixa} onChange={(e) => {
              const value = e.target.value;
              if (value.startsWith('-')) return;
              const clean = value.replace(/[^\d,]/g, '').replace(/,+/g, ',');
              const parts = clean.split(',');
              if (parts[1] && parts[1].length > 2) {
                setValorCaixa(parts[0] + ',' + parts[1].slice(0, 2));
              } else {
                setValorCaixa(clean);
              }
            }} placeholder="0,00" inputMode="decimal" autoFocus className={`${inputCls} mt-1 text-center text-xl font-black`} />
            <label className="mt-3 block text-xs font-bold text-gray-600 dark:text-gray-300">Motivo</label>
            <input value={motivoCaixa} onChange={(e) => setMotivoCaixa(e.target.value)} placeholder={modalCaixa === 'SANGRIA' ? 'ex: depósito no cofre' : 'ex: troco do banco'} className={`${inputCls} mt-1`} />
            <button onClick={() => registrarMov(modalCaixa)} disabled={salvandoCaixa || Number(String(valorCaixa).replace(',', '.') || 0) <= 0} className="mt-4 w-full rounded-2xl bg-[var(--cor-primaria)] py-3.5 text-sm font-black text-white disabled:opacity-50">
              {salvandoCaixa ? 'Registrando…' : 'Registrar'}
            </button>
          </>
        )}
        {modalCaixa === 'FECHAR' && turno && (
          <>
            <h3 className="text-lg font-black dark:text-gray-100">Fechar o caixa</h3>
            <div className="mt-3 space-y-1.5 rounded-2xl bg-gray-50 p-4 text-xs dark:bg-gray-800/50">
              <div className="flex justify-between text-gray-500"><span>Fundo de troco</span><span>{fmt(Number(turno.fundo_troco))}</span></div>
              <div className="flex justify-between text-gray-500"><span>{tDynamic('Vendas em dinheiro (balcão)')}</span><span>+{fmt(dinheiroTurno)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Reforços</span><span>+{fmt(reforcos)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Sangrias</span><span>-{fmt(sangrias)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5 text-sm font-black dark:border-gray-700 dark:text-gray-100"><span>{tDynamic('Deve ter na gaveta')}</span><span>{fmt(dinheiroGaveta)}</span></div>
            </div>
            <label className="mt-4 block text-xs font-bold text-gray-600 dark:text-gray-300">{tDynamic('Quanto você contou na gaveta? (R$)')}</label>
            <input value={valorCaixa} onChange={(e) => {
              const value = e.target.value;
              if (value.startsWith('-')) return;
              const clean = value.replace(/[^\d,]/g, '').replace(/,+/g, ',');
              const parts = clean.split(',');
              if (parts[1] && parts[1].length > 2) {
                setValorCaixa(parts[0] + ',' + parts[1].slice(0, 2));
              } else {
                setValorCaixa(clean);
              }
            }} placeholder="0,00" inputMode="decimal" autoFocus className={`${inputCls} mt-1 text-center text-xl font-black`} />
            {valorCaixa !== '' && (
              <p className={`mt-2 text-center text-sm font-bold ${Math.abs(Number(String(valorCaixa).replace(',', '.') || 0) - dinheiroGaveta) < 0.005 ? 'text-emerald-600' : 'text-red-500'}`}>
                {Math.abs(Number(String(valorCaixa).replace(',', '.') || 0) - dinheiroGaveta) < 0.005
                  ? '✓ Caixa bateu!'
                  : `Diferença: ${fmt(Number(String(valorCaixa).replace(',', '.') || 0) - dinheiroGaveta)}`}
              </p>
            )}
            <input value={obsFechamento} onChange={(e) => setObsFechamento(e.target.value)} placeholder="Observação (opcional)" className={`${inputCls} mt-3`} />
            <button onClick={fecharTurno} disabled={salvandoCaixa || valorCaixa === ''} className="mt-4 w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-black text-white disabled:opacity-50 dark:bg-gray-700">
              {salvandoCaixa ? 'Fechando…' : 'Fechar turno'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { PartyPopper, ChefHat, Receipt } from 'lucide-react';
import { fmt } from '../../types';
import type { OrderSuccessModalProps } from '../../types';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';
import { Loader2, FileText } from 'lucide-react';

export function OrderSuccessModal({ venda, imprimirVenda, limparVenda }: OrderSuccessModalProps) {
  const { tDynamic } = useI18n();
  useEffect(() => {
    if (venda) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'],
        disableForReducedMotion: true
      });
    }
  }, [venda]);

  const [emitindo, setEmitindo] = useState(false);
  const [nfeUrl, setNfeUrl] = useState<string | null>(null);
  const [nfeErro, setNfeErro] = useState('');

  if (!venda) return null;

  const emitirNfce = async () => {
    setEmitindo(true);
    setNfeErro('');
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-emitir-nfce', {
        body: { pedido_id: venda.pedidoId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      if (data?.url) setNfeUrl(data.url);
      else setNfeErro('NFC-e autorizada, mas URL não retornou.');
    } catch (e: any) {
      console.error(e);
      setNfeErro('Erro ao emitir: ' + (e.message || String(e)));
    }
    setEmitindo(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
          <PartyPopper size={28} />
        </div>
        <h3 className="mt-3 text-xl font-black dark:text-gray-100">Venda #{venda.numero} registrada!</h3>

        {/* A senha é o que o operador FALA para o cliente e o que a TV vai
            chamar. Sem ela na tela, o atendente dizia o número do pedido em
            voz alta e o cliente ficava esperando um número que nunca aparece
            no painel. Fica grande porque é ditada de cabeça, no barulho. */}
        {venda.senha != null && (
          <div className="mt-3 rounded-2xl border-2 border-dashed border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 py-3">
            <p className="text-xs opacity-95 font-bold uppercase tracking-[0.2em] text-gray-500">{tDynamic('Senha do cliente')}</p>
            <p className="font-['Sora'] text-5xl font-black leading-tight text-[var(--cor-primaria)]">{venda.senha}</p>
            <p className="text-xs opacity-95 font-semibold text-gray-500">{tDynamic('Diga esta senha ao cliente — é ela que aparece na TV')}</p>
          </div>
        )}

        <p className="mt-1 text-sm text-gray-500">
          {fmt(venda.total)} · {venda.metodo === 'DINHEIRO' ? 'Dinheiro' : venda.metodo === 'PIX' ? 'Pix' : venda.metodo === 'CREDITO' ? 'Crédito' : 'Débito'}
          {venda.temCozinha ? ' · já está na cozinha 🔥' : ' · Pronto! Entregue ao cliente ✅'}
        </p>
        {venda.troco > 0 && (
          <p className="mt-3 rounded-2xl bg-emerald-50 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            Devolver troco: <span className="text-2xl font-black">{fmt(venda.troco)}</span>
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {venda.temCozinha && (
            <button onClick={() => imprimirVenda('COMANDA_COZINHA')} className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 py-3 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">
              <ChefHat size={14} /> Comanda cozinha
            </button>
          )}
          <button onClick={() => imprimirVenda('RECIBO_CLIENTE')} className={`flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 py-3 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300 ${!venda.temCozinha ? 'col-span-2' : ''}`}>
            <Receipt size={14} /> Nota cliente
          </button>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          {!nfeUrl ? (
            <button 
              onClick={emitirNfce} 
              disabled={emitindo}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 py-3 text-sm font-bold text-[var(--cor-primaria)] transition hover:bg-[var(--cor-primaria)]/20 disabled:opacity-50"
            >
              {emitindo ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {emitindo ? 'Emitindo NFC-e...' : 'Emitir Cupom Fiscal (NFC-e)'}
            </button>
          ) : (
            <a 
              href={nfeUrl} 
              target="_blank" 
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <FileText size={16} /> Imprimir DANFE (Fiscal)
            </a>
          )}
          {nfeErro && <p className="mt-2 text-xs font-semibold text-red-500">{nfeErro}</p>}
        </div>

        <button onClick={limparVenda} className="mt-4 w-full rounded-2xl bg-[var(--cor-primaria)] py-4 text-base font-black text-white shadow-lg">
          Nova venda
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link2, Loader2, ShieldOff, Tv } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useI18n } from '../../contexts/I18nContext';

type Props = { lojaId: string };
type Modo = 'AUTO' | 'CARDAPIO' | 'SENHAS';

const MODOS: { valor: Modo; rotulo: string }[] = [
  { valor: 'AUTO', rotulo: 'Automática' },
  { valor: 'CARDAPIO', rotulo: 'Cardápio' },
  { valor: 'SENHAS', rotulo: 'Senhas' },
];

export function TvPairingControl({ lojaId }: Props) {
  const { tDynamic } = useI18n();
  const toast = useToast();
  const [codigo, setCodigo] = useState('');
  const [modo, setModo] = useState<Modo>('AUTO');
  const [enviando, setEnviando] = useState(false);
  const [revogando, setRevogando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const autorizar = async () => {
    if (enviando) return;
    const normalizado = codigo.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (normalizado.length !== 6) {
      setMensagem('Digite os 6 caracteres exibidos na TV.');
      return;
    }
    setEnviando(true);
    setMensagem('');
    const { data, error } = await supabase.rpc('fn_tv_pareamento_autorizar', {
      p_loja_id: lojaId,
      p_codigo: normalizado,
      p_modo: modo,
    });
    setEnviando(false);
    if (error) {
      setMensagem(error.message.includes('expirado') ? 'Código não encontrado ou expirado. Gere outro na TV.' : 'Não foi possível autorizar esta TV.');
      return;
    }
    const expira = (data as { sessao_expira_em: string }[] | null)?.[0]?.sessao_expira_em;
    setCodigo('');
    setMensagem(expira ? `TV conectada. A sessão expira em ${new Date(expira).toLocaleDateString('pt-BR')}.` : 'TV conectada com segurança.');
    toast('TV pareada com sucesso', 'sucesso');
  };

  const revogar = async () => {
    if (!window.confirm('Desconectar todas as TVs pareadas desta loja? Os links antigos continuam separados.')) return;
    setRevogando(true);
    const { data, error } = await supabase.rpc('fn_tv_sessoes_revogar', { p_loja_id: lojaId });
    setRevogando(false);
    if (error) {
      setMensagem('Não foi possível revogar as TVs agora.');
      return;
    }
    setMensagem(`${Number(data ?? 0)} TV(s) pareada(s) desconectada(s).`);
    toast('Sessões de TV revogadas', 'sucesso');
  };

  return (
    <section className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3" aria-labelledby="tv-pairing-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="tv-pairing-title" className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100"><Link2 size={17} className="text-orange-500" /> {tDynamic('Parear por código')}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Abra somente <strong>/tv</strong> no aparelho. Digite abaixo o código exibido — sem copiar token ou login.</p>
        </div>
        <button type="button" onClick={revogar} disabled={revogando} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-500/30 px-3 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50">
          {revogando ? <Loader2 size={15} className="animate-spin" /> : <ShieldOff size={15} />} Revogar TVs pareadas
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={codigo}
          onChange={(event) => setCodigo(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6))}
          onKeyDown={(event) => event.key === 'Enter' && autorizar()}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABC234"
          aria-label="Código exibido na TV"
          className="min-h-12 w-36 rounded-lg border border-gray-300 bg-white px-3 text-center font-mono text-lg font-black tracking-widest text-gray-900 uppercase dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        {MODOS.map((item) => (
          <button key={item.valor} type="button" onClick={() => setModo(item.valor)} aria-pressed={modo === item.valor} className={`min-h-12 rounded-lg border px-3 text-xs font-bold ${modo === item.valor ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
            {item.rotulo}
          </button>
        ))}
        <button type="button" onClick={autorizar} disabled={enviando} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50">
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Tv size={16} />} Autorizar TV
        </button>
      </div>
      {mensagem && <p role="status" className="mt-2 text-xs font-bold text-gray-600 dark:text-gray-300">{mensagem}</p>}
      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{tDynamic('Código: 10 minutos. Sessão: 7 dias ou até revogação. Cada sessão fica presa a esta loja e ao conteúdo escolhido.')}</p>
    </section>
  );
}

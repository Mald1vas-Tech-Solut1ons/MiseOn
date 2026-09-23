import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, MousePointerClick, Eye, AlertTriangle, UserCheck, UserX, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';

/**
 * E-mail medido de ponta a ponta.
 *
 * Cada envio é uma linha em `email_log` com token próprio. Os links passam por
 * miseon.app.br/e/... (função email-rastreio), que grava abertura, clique e
 * descadastro. Conversão só existe onde ela faz sentido: na retomada de
 * cadastro, "converteu" = criou a loja depois de receber o e-mail.
 *
 * Abertura é ESTIMADA (Apple Mail pré-carrega imagem; há quem bloqueie).
 * Clique e conversão são os números em que se pode confiar.
 */

type Campanha = {
  campanha: string; classe: string | null; enviados: number; falhas: number; abertos: number;
  clicados: number; descadastros: number; convertidos: number | null;
  primeiro_envio: string; ultimo_envio: string;
};
type Envio = {
  id: string; campanha: string; classe: string | null; destinatario: string; loja_nome: string | null;
  status: string; erro: string | null; enviado_em: string; aberto_em: string | null; aberturas: number;
  clicado_em: string | null; cliques: number; descadastrado_em: string | null; convertido_em: string | null;
};

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function Emails() {
  const { tDynamic } = useI18n();
  const [dias, setDias] = useState(30);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const nomeCampanha: Record<string, string> = useMemo(() => ({
    'retomada-cadastro-1': tDynamic('Retomada de cadastro · 1º lembrete'),
    'retomada-cadastro-2': tDynamic('Retomada de cadastro · 2º lembrete'),
    'boas-vindas-loja': tDynamic('Boas-vindas ao lojista'),
    'nota-fiscal-assinatura': tDynamic('Nota fiscal da assinatura'),
    'acesso-equipe': tDynamic('Convite de equipe'),
    'pedido-recebido': tDynamic('Pedido recebido (cliente da loja)'),
    'pagamento-confirmado': tDynamic('Pagamento confirmado (cliente da loja)'),
    'pedido-a-caminho': tDynamic('Pedido a caminho (cliente da loja)'),
    'pedido-entregue': tDynamic('Pedido entregue (cliente da loja)'),
    'carrinho-abandonado': tDynamic('Carrinho abandonado (cliente da loja)'),
    'cupom-disponivel': tDynamic('Cupom disponível (cliente da loja)'),
  }), [tDynamic]);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    const [c, e] = await Promise.all([
      supabase.rpc('fn_superadmin_email_campanhas', { p_dias: dias }),
      supabase.rpc('fn_superadmin_email_envios', { p_dias: dias, p_campanha: filtro }),
    ]);
    if (c.error || e.error) setErro((c.error ?? e.error)!.message);
    setCampanhas((c.data ?? []) as Campanha[]);
    setEnvios((e.data ?? []) as Envio[]);
    setCarregando(false);
  }, [dias, filtro]);

  useEffect(() => { void carregar(); }, [carregar]);

  const plataforma = campanhas.filter((c) => c.classe === 'PLATAFORMA' || c.campanha.startsWith('retomada-'));
  const lojas = campanhas.filter((c) => !plataforma.includes(c));

  const cartao = (c: Campanha) => (
    <button key={c.campanha} type="button" onClick={() => setFiltro(filtro === c.campanha ? null : c.campanha)}
      className={`rounded-2xl border p-4 text-left transition-colors ${filtro === c.campanha ? 'border-[#FC5B24] bg-[#FC5B24]/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
      <p className="font-bold">{nomeCampanha[c.campanha] ?? c.campanha}</p>
      <p className="mt-0.5 text-xs text-slate-400">{tDynamic('Último envio')}: {quando(c.ultimo_envio)}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        <Metrica icone={<Send size={12} />} rotulo={tDynamic('Enviados')} valor={String(c.enviados)} />
        <Metrica icone={<AlertTriangle size={12} />} rotulo={tDynamic('Falhas')} valor={String(c.falhas)} alerta={c.falhas > 0} />
        <Metrica icone={<Eye size={12} />} rotulo={tDynamic('Abertura*')} valor={pct(c.abertos, c.enviados)} />
        <Metrica icone={<MousePointerClick size={12} />} rotulo={tDynamic('Clique')} valor={pct(c.clicados, c.enviados)} />
        <Metrica icone={<UserX size={12} />} rotulo={tDynamic('Descadastro')} valor={String(c.descadastros)} />
        <Metrica icone={<UserCheck size={12} />} rotulo={tDynamic('Converteu')}
          valor={c.convertidos == null ? '—' : `${c.convertidos} (${pct(c.convertidos, c.enviados)})`} />
      </div>
    </button>
  );

  return (
    <div className="text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-['Sora'] text-2xl font-black tracking-tight"><Mail size={22} /> {tDynamic('E-mails')}</h1>
          <p className="mt-1 text-sm text-slate-400">{tDynamic('Tudo o que a plataforma e as lojas enviaram, com abertura, clique, descadastro e conversão. Clique numa campanha para filtrar os envios.')}</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDias(d)}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${dias === d ? 'bg-white text-slate-900' : 'border border-white/10 bg-white/5 text-slate-300'}`}>
              {d} {tDynamic('dias')}
            </button>
          ))}
          <button type="button" onClick={carregar}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FC5B24] px-3 py-2 text-xs font-black text-white hover:brightness-110">
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> {tDynamic('Atualizar')}
          </button>
        </div>
      </div>

      {erro && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{erro}</p>}

      <h2 className="mb-2 font-['Sora'] text-lg font-black">{tDynamic('Plataforma → lojistas')}</h2>
      <div className="mb-6 grid gap-3">
        {plataforma.length ? plataforma.map(cartao) : <p className="text-sm text-slate-400">{tDynamic('Nenhum envio nesta janela.')}</p>}
      </div>

      <h2 className="mb-2 font-['Sora'] text-lg font-black">{tDynamic('Lojas → clientes delas')}</h2>
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        {lojas.length ? lojas.map(cartao) : <p className="text-sm text-slate-400">{tDynamic('Nenhum envio nesta janela.')}</p>}
      </div>
      <p className="mb-6 text-xs text-slate-500">{tDynamic('*Abertura é estimada: alguns aplicativos de e-mail carregam a imagem sozinhos e outros a bloqueiam. Clique e conversão são as medidas confiáveis. O rastreio de abertura e clique começou em 23/09/2026.')}</p>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-['Sora'] text-lg font-black">
          {tDynamic('Envios')} {filtro && <span className="text-sm font-normal text-slate-400">· {nomeCampanha[filtro] ?? filtro}</span>}
        </h2>
        {filtro && <button type="button" onClick={() => setFiltro(null)} className="text-xs font-bold text-[#FC5B24]">{tDynamic('Ver todos')}</button>}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">{tDynamic('Destinatário')}</th>
              <th className="p-3">{tDynamic('Campanha')}</th>
              <th className="p-3">{tDynamic('Enviado')}</th>
              <th className="p-3">{tDynamic('Situação')}</th>
              <th className="p-3">{tDynamic('Abriu')}</th>
              <th className="p-3">{tDynamic('Clicou')}</th>
              <th className="p-3">{tDynamic('Resultado')}</th>
            </tr>
          </thead>
          <tbody>
            {envios.map((e) => (
              <tr key={e.id} className="border-t border-white/5 align-top">
                <td className="p-3">
                  <p className="font-bold">{e.destinatario}</p>
                  {e.loja_nome && <p className="text-xs text-slate-400">{e.loja_nome}</p>}
                  {e.classe === 'PREVIA' && <span className="text-xs font-bold text-amber-300">{tDynamic('Prévia (não conta na métrica)')}</span>}
                </td>
                <td className="p-3 text-xs text-slate-300">{nomeCampanha[e.campanha] ?? e.campanha}</td>
                <td className="p-3 text-xs text-slate-300">{quando(e.enviado_em)}</td>
                <td className="p-3 text-xs">
                  {e.status === 'sent' ? <span className="font-bold text-emerald-300">{tDynamic('Entregue ao servidor')}</span>
                    : e.status === 'failed' ? <span className="font-bold text-red-300" title={e.erro ?? ''}>{tDynamic('Falhou')}</span>
                      : <span className="text-slate-400">{e.status}</span>}
                  {e.erro && <p className="mt-1 max-w-[220px] break-words text-red-300/80">{e.erro}</p>}
                </td>
                <td className="p-3 text-xs text-slate-300">{e.aberto_em ? `${quando(e.aberto_em)} (${e.aberturas}×)` : '—'}</td>
                <td className="p-3 text-xs text-slate-300">{e.clicado_em ? `${quando(e.clicado_em)} (${e.cliques}×)` : '—'}</td>
                <td className="p-3 text-xs">
                  {e.convertido_em ? <span className="font-bold text-emerald-300">{tDynamic('Criou a loja')} · {quando(e.convertido_em)}</span>
                    : e.descadastrado_em ? <span className="font-bold text-slate-400">{tDynamic('Descadastrou')}</span> : '—'}
                </td>
              </tr>
            ))}
            {!envios.length && (
              <tr><td colSpan={7} className="p-6 text-center text-sm text-slate-400">{tDynamic('Nenhum envio nesta janela.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metrica({ icone, rotulo, valor, alerta }: { icone: React.ReactNode; rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`rounded-xl bg-black/20 px-2 py-2 ${alerta ? 'ring-1 ring-red-400/60' : ''}`}>
      <p className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-slate-400">{icone}{rotulo}</p>
      <p className={`mt-0.5 text-base font-black ${alerta ? 'text-red-300' : ''}`}>{valor}</p>
    </div>
  );
}

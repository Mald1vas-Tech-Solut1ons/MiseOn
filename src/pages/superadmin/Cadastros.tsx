import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, UserX, Store, UtensilsCrossed, ShoppingBag, Mail, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Funil de cadastro: quem entrou, até onde chegou, onde parou.
 *
 * Existe porque em 22/09/2026 uma lead real entrou com Google, fez um login e
 * sumiu — e só deu para saber consultando o banco na mão. Cada conta aparece
 * no degrau mais alto que alcançou (sem loja → loja sem cardápio → cardápio
 * sem pedido → vendendo). Os números saem de `fn_superadmin_cadastros`; os
 * passos dentro da tela de cadastro, de `fn_superadmin_funil_eventos`.
 */

type Conta = {
  user_id: string; email: string; nome: string | null; provedor: string;
  conta_criada_em: string; ultimo_login_em: string | null;
  situacao: 'sem_loja' | 'loja_sem_cardapio' | 'cardapio_sem_pedido' | 'vendendo' | 'equipe';
  etapa: string | null; ultimo_evento: string | null; ultimo_erro: string | null;
  eventos: number; atividade_em: string | null;
  loja_nome: string | null; loja_slug: string | null; loja_criada_em: string | null;
  produtos: number; pedidos: number;
  retomadas_enviadas: number; ultima_retomada_em: string | null; retomada_optout: boolean;
};
type PassoFunil = { evento: string; etapa: string; contas: number; ocorrencias: number };

const ORDEM = ['sem_loja', 'loja_sem_cardapio', 'cardapio_sem_pedido', 'vendendo'] as const;

const ha = (iso: string | null) => {
  if (!iso) return '—';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
};

/** Onde a pessoa parou, em português de gente. Sem rastro = conta anterior ao rastreio. */
function ondeParou(c: Conta, t: (s: string) => string): string {
  if (c.situacao === 'loja_sem_cardapio') return t('Criou a loja, não cadastrou produto');
  if (c.situacao === 'cardapio_sem_pedido') return t('Tem cardápio, nenhum pedido ainda');
  if (c.situacao === 'vendendo') return t('Vendendo');
  if (c.situacao === 'equipe') return t('Membro de equipe');
  if (!c.ultimo_evento) return t('Entrou e não voltou à tela de cadastro (sem rastro: conta anterior ao rastreio)');
  if (c.ultimo_evento === 'erro_criar') return t('Tentou criar a loja e deu erro');
  if (c.ultimo_evento === 'erro_validacao') return t('Tentou criar com campo faltando');
  if (c.etapa === 'criando') return t('Clicou em criar e não concluiu');
  if (c.etapa === 'segmento' || c.etapa === 'loja') return t('Começou a preencher e parou');
  return t('Abriu a tela de cadastro e não preencheu');
}

export default function Cadastros() {
  const { tDynamic } = useI18n();
  const [dias, setDias] = useState(30);
  const [contas, setContas] = useState<Conta[]>([]);
  const [passos, setPassos] = useState<PassoFunil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    const [c, p] = await Promise.all([
      supabase.rpc('fn_superadmin_cadastros', { p_dias: dias }),
      supabase.rpc('fn_superadmin_funil_eventos', { p_dias: dias }),
    ]);
    if (c.error) setErro(c.error.message);
    setContas((c.data ?? []) as Conta[]);
    setPassos((p.data ?? []) as PassoFunil[]);
    setCarregando(false);
  }, [dias]);

  useEffect(() => { void carregar(); }, [carregar]);

  const donos = useMemo(() => contas.filter((c) => c.situacao !== 'equipe'), [contas]);
  // Degrau alcançado: quem está em "vendendo" também passou por todos os anteriores.
  const funil = useMemo(() => {
    const nivel = (s: Conta['situacao']) => ORDEM.indexOf(s as typeof ORDEM[number]);
    const passou = (n: number) => donos.filter((c) => nivel(c.situacao) >= n).length;
    return [
      { rotulo: tDynamic('Contas criadas'), qtd: donos.length, icone: <UserX size={16} /> },
      { rotulo: tDynamic('Criaram a loja'), qtd: passou(1), icone: <Store size={16} /> },
      { rotulo: tDynamic('Cadastraram produto'), qtd: passou(2), icone: <UtensilsCrossed size={16} /> },
      { rotulo: tDynamic('Receberam pedido'), qtd: passou(3), icone: <ShoppingBag size={16} /> },
    ];
  }, [donos, tDynamic]);

  const semLoja = donos.filter((c) => c.situacao === 'sem_loja');
  const travados = donos.filter((c) => c.situacao === 'loja_sem_cardapio' || c.situacao === 'cardapio_sem_pedido');

  return (
    <div className="text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-black tracking-tight">{tDynamic('Funil de cadastro')}</h1>
          <p className="mt-1 text-sm text-slate-400">{tDynamic('Quem entrou, até onde chegou e onde parou. Contas de demonstração e da plataforma ficam de fora.')}</p>
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

      {/* Funil: cada barra é proporcional ao total de contas; o % é sobre o degrau anterior. */}
      <div className="mb-8 grid gap-2">
        {funil.map((f, i) => {
          const anterior = i === 0 ? f.qtd : funil[i - 1].qtd;
          const pct = anterior > 0 ? Math.round((f.qtd / anterior) * 100) : 0;
          const largura = funil[0].qtd > 0 ? Math.max(4, (f.qtd / funil[0].qtd) * 100) : 4;
          return (
            <div key={f.rotulo} className="flex items-center gap-3">
              <div className="flex w-48 shrink-0 items-center gap-2 text-sm text-slate-300">{f.icone}{f.rotulo}</div>
              <div className="h-8 flex-1 rounded-lg bg-white/5">
                <div className="flex h-8 items-center rounded-lg bg-[#0A5CC4] px-3 text-sm font-black" style={{ width: `${largura}%` }}>{f.qtd}</div>
              </div>
              <div className="w-24 shrink-0 text-right text-xs text-slate-400">{i === 0 ? '' : `${pct}% ${tDynamic('do anterior')}`}</div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 font-['Sora'] text-lg font-black">{tDynamic('Entraram e não criaram a loja')} ({semLoja.length})</h2>
      <p className="mb-3 text-xs text-slate-400">{tDynamic('É aqui que o lead esfria. A retomada por e-mail manda no máximo dois lembretes; o contato pessoal continua sendo o que mais converte.')}</p>
      {semLoja.length === 0 ? (
        <p className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">{tDynamic('Ninguém parado nesta janela.')}</p>
      ) : (
        <div className="mb-8 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="p-3">{tDynamic('Conta')}</th>
                <th className="p-3">{tDynamic('Entrou há')}</th>
                <th className="p-3">{tDynamic('Onde parou')}</th>
                <th className="p-3">{tDynamic('Lembretes')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {semLoja.map((c) => (
                <tr key={c.user_id} className="border-t border-white/5 align-top">
                  <td className="p-3">
                    <p className="font-bold">{c.nome || c.email}</p>
                    <p className="text-xs text-slate-400">{c.email} · {c.provedor}</p>
                  </td>
                  <td className="p-3 text-slate-300">{ha(c.conta_criada_em)}</td>
                  <td className="p-3">
                    <p className="text-slate-200">{ondeParou(c, tDynamic)}</p>
                    {c.ultimo_erro && <p className="mt-1 flex items-center gap-1 text-xs text-amber-300"><AlertTriangle size={12} /> {c.ultimo_erro}</p>}
                  </td>
                  <td className="p-3 text-xs text-slate-400">
                    {c.retomada_optout ? tDynamic('Pediu para não receber')
                      : c.retomadas_enviadas > 0 ? `${c.retomadas_enviadas}/2 · ${ha(c.ultima_retomada_em)}`
                        : tDynamic('Nenhum')}
                  </td>
                  <td className="p-3 text-right">
                    <a href={`mailto:${c.email}?subject=${encodeURIComponent('Sua loja no MiseOn')}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10">
                      <Mail size={12} /> {tDynamic('Escrever')}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-2 font-['Sora'] text-lg font-black">{tDynamic('Criaram a loja e não chegaram a vender')} ({travados.length})</h2>
      {travados.length === 0 ? (
        <p className="mb-8 text-sm text-slate-400">{tDynamic('Ninguém nesta situação.')}</p>
      ) : (
        <div className="mb-8 grid gap-2">
          {travados.map((c) => (
            <div key={c.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <div>
                <p className="font-bold">{c.loja_nome} <span className="text-xs font-normal text-slate-400">/{c.loja_slug}</span></p>
                <p className="text-xs text-slate-400">{c.email} · {tDynamic('loja criada há')} {ha(c.loja_criada_em)} · {c.produtos} {tDynamic('produtos')}</p>
              </div>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">{ondeParou(c, tDynamic)}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 font-['Sora'] text-lg font-black">{tDynamic('Passos dentro da tela de cadastro')}</h2>
      {passos.length === 0 ? (
        <p className="text-sm text-slate-400">{tDynamic('Ainda sem eventos: o rastreio começou em 22/09/2026 e só registra quem abrir a tela a partir daí.')}</p>
      ) : (
        <div className="grid gap-1 text-sm">
          {passos.map((p) => (
            <div key={`${p.evento}-${p.etapa}`} className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="font-mono text-xs text-slate-300">{p.evento} · {p.etapa}</span>
              <span className="text-xs text-slate-400">{p.contas} {tDynamic('contas')} · {p.ocorrencias}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

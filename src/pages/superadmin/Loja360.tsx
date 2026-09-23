import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Check, X, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Ficha 360 de uma loja: tudo o que o dono do SaaS precisa para uma ligação
 * de sucesso do cliente ou de cobrança — quem opera, o que já configurou,
 * quanto vende, o que pagou, que e-mails recebeu e que erros viu.
 * Uma chamada: `fn_superadmin_loja_360`.
 */

type Ficha = {
  loja: { id: string; nome: string; slug: string; ativo: boolean; eh_teste: boolean; plano: string | null;
    status_assinatura: string | null; trial_termina_em: string | null; criado_em: string; totem_ativo: boolean | null };
  equipe: { email: string; papel: string; ultimo_login: string | null }[];
  cadastro: { segmento: string | null; faz_entregas: boolean | null; atende_salao: boolean | null; fiscal_completo: boolean; email_cobranca: string | null } | null;
  configuracao: { produtos: number; insumos: number; fichas_tecnicas: number; notas_importadas: number; pix_configurado: boolean };
  uso: { pedidos_7d: number; pedidos_30d: number; gmv_30d: number; ultimo_pedido: string | null; canais_30d: Record<string, number> };
  faturas: { criada: string; ciclo: string; valor: number; status: string; pago_em: string | null; nfse: string | null }[];
  emails_30d: { campanha: string; enviados: number; falhas: number }[];
  erros_7d: { mensagem: string; ocorrencias: number; ultimo: string }[];
};

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const real = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Loja360() {
  const { tDynamic } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [f, setF] = useState<Ficha | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true); setErro('');
    const { data: d, error } = await supabase.rpc('fn_superadmin_loja_360', { p_loja_id: id });
    if (error) setErro(error.message);
    setF((d ?? null) as Ficha | null);
    setCarregando(false);
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  if (!f) {
    return <div className="text-white">{erro ? <p className="text-red-300">{erro}</p> : <p className="text-slate-400">{carregando ? tDynamic('Carregando…') : tDynamic('Loja não encontrada.')}</p>}</div>;
  }

  const passos: [string, boolean][] = [
    [tDynamic('Cardápio com produtos'), f.configuracao.produtos > 0],
    [tDynamic('Insumos cadastrados'), f.configuracao.insumos > 0],
    [tDynamic('Ficha técnica'), f.configuracao.fichas_tecnicas > 0],
    [tDynamic('Nota fiscal importada'), f.configuracao.notas_importadas > 0],
    [tDynamic('Recebimento por Pix configurado'), f.configuracao.pix_configurado],
    [tDynamic('Dados fiscais para cobrança'), !!f.cadastro?.fiscal_completo],
    [tDynamic('Primeiro pedido'), !!f.uso.ultimo_pedido],
  ];
  const feitos = passos.filter(([, ok]) => ok).length;

  return (
    <div className="text-white">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/superadmin" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"><ArrowLeft size={14} /> {tDynamic('Visão do negócio')}</Link>
          <h1 className="font-['Sora'] text-2xl font-black tracking-tight">{f.loja.nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <a href={`https://miseon.app.br/${f.loja.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">/{f.loja.slug} <ExternalLink size={12} /></a>
            · {tDynamic('criada em')} {data(f.loja.criado_em)}
            {f.loja.eh_teste && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{tDynamic('loja de teste')}</span>}
            {!f.loja.ativo && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">{tDynamic('inativa')}</span>}
          </p>
        </div>
        <button type="button" onClick={carregar}
          className="inline-flex items-center gap-2 rounded-xl bg-[#FC5B24] px-3 py-2 text-xs font-black text-white hover:brightness-110">
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> {tDynamic('Atualizar')}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Secao titulo={tDynamic('Assinatura')}>
          <Linha k={tDynamic('Situação')} v={f.loja.status_assinatura ?? 'trial'} />
          <Linha k={tDynamic('Plano')} v={f.loja.plano ?? '—'} />
          <Linha k={tDynamic('Válida até')} v={data(f.loja.trial_termina_em)} />
          <Linha k={tDynamic('Segmento')} v={f.cadastro?.segmento ?? '—'} />
          <Linha k={tDynamic('E-mail de cobrança')} v={f.cadastro?.email_cobranca ?? '—'} />
        </Secao>

        <Secao titulo={`${tDynamic('Configuração')} · ${feitos}/${passos.length}`}>
          {passos.map(([rotulo, ok]) => (
            <p key={rotulo} className="flex items-center gap-2 text-sm">
              {ok ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-slate-500" />}
              <span className={ok ? '' : 'text-slate-400'}>{rotulo}</span>
            </p>
          ))}
        </Secao>

        <Secao titulo={tDynamic('Uso')}>
          <Linha k={tDynamic('Pedidos 7 dias')} v={String(f.uso.pedidos_7d)} />
          <Linha k={tDynamic('Pedidos 30 dias')} v={String(f.uso.pedidos_30d)} />
          <Linha k={tDynamic('Vendido em 30 dias')} v={real(f.uso.gmv_30d)} />
          <Linha k={tDynamic('Último pedido')} v={dataHora(f.uso.ultimo_pedido)} />
          <Linha k={tDynamic('Canais (30 dias)')} v={Object.entries(f.uso.canais_30d ?? {}).map(([c, n]) => `${c} ${n}`).join(' · ') || '—'} />
        </Secao>

        <Secao titulo={tDynamic('Equipe')}>
          {f.equipe.length === 0 ? <p className="text-sm text-slate-400">{tDynamic('Ninguém vinculado.')}</p>
            : f.equipe.map((m) => (
              <div key={m.email} className="text-sm">
                <p className="font-bold">{m.email} <span className="text-xs font-normal text-slate-400">· {m.papel}</span></p>
                <p className="text-xs text-slate-500">{tDynamic('Último acesso')}: {dataHora(m.ultimo_login)}</p>
              </div>
            ))}
        </Secao>

        <Secao titulo={tDynamic('Faturas')}>
          {f.faturas.length === 0 ? <p className="text-sm text-slate-400">{tDynamic('Nenhuma fatura.')}</p>
            : f.faturas.map((x, i) => (
              <p key={i} className="flex justify-between gap-2 text-sm">
                <span>{data(x.criada)} · {x.ciclo}</span>
                <span className={x.status === 'pago' ? 'text-emerald-300' : 'text-amber-300'}>{real(x.valor)} · {x.status}</span>
              </p>
            ))}
        </Secao>

        <Secao titulo={tDynamic('E-mails (30 dias)')}>
          {f.emails_30d.length === 0 ? <p className="text-sm text-slate-400">{tDynamic('Nenhum envio.')}</p>
            : f.emails_30d.map((e) => (
              <p key={e.campanha} className="flex justify-between text-sm">
                <span>{e.campanha}</span>
                <span className={e.falhas > 0 ? 'text-red-300' : 'text-slate-300'}>{e.enviados} {e.falhas > 0 ? `· ${e.falhas} ${tDynamic('falhas')}` : ''}</span>
              </p>
            ))}
        </Secao>
      </div>

      <div className="mt-4">
        <Secao titulo={tDynamic('Erros vistos por esta loja (7 dias)')}>
          {f.erros_7d.length === 0 ? <p className="text-sm text-emerald-300">{tDynamic('Nenhum erro registrado.')}</p>
            : f.erros_7d.map((e, i) => (
              <p key={i} className="text-sm"><span className="font-mono text-slate-200">{e.mensagem}</span> <span className="text-xs text-slate-500">· {e.ocorrencias}× · {dataHora(e.ultimo)}</span></p>
            ))}
        </Secao>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-black uppercase tracking-wider text-slate-300">{titulo}</p>
      {children}
    </section>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return <p className="flex justify-between gap-3 text-sm"><span className="text-slate-400">{k}</span><span className="text-right font-bold">{v}</span></p>;
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Wallet, TrendingUp, Activity, HeartPulse, AlertTriangle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';

/**
 * A tela inicial do dono do SaaS.
 *
 * Responde em um minuto: quanto entrou, quem está entrando, quem travou,
 * quem está parando e o que está quebrando — e cada item leva à loja ou à
 * pessoa. Números saem de `fn_superadmin_painel` (agregado no banco, lojas
 * de teste fora) e a lista de `fn_superadmin_atencao`, em ordem de dinheiro.
 *
 * Receita é dinheiro que ENTROU (faturas pagas). Não se estima receita
 * recorrente por tabela de preço: número que não foi medido não vai para a tela.
 */

type Painel = {
  dias: number; lojas_teste: number;
  assinaturas: { total: number; pagantes: number; vitalicias: number; em_teste: number; teste_vencido: number;
    teste_vence_7d: number; atrasadas: number; canceladas: number };
  receita: { recebido_periodo: number; faturas_pagas_periodo: number; faturas_abertas_periodo: number; notas_pendentes: number };
  contas: { novas: number; com_loja: number };
  ativacao: { criadas: number; com_produto: number; com_pedido: number };
  uso: { pedidos: number; gmv: number; lojas_com_pedido: number };
  risco: { sem_pedido_14d: number };
  email_7d: { enviados: number; falhas: number };
};
type Atencao = { tipo: string; prioridade: number; loja_id: string | null; loja_nome: string; loja_slug: string | null; detalhe: string; quando: string | null };
type FamiliaErro = { categoria: string; estado: string };

const real = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

export default function Painel() {
  const { tDynamic } = useI18n();
  const [dias, setDias] = useState(30);
  const [p, setP] = useState<Painel | null>(null);
  const [atencao, setAtencao] = useState<Atencao[]>([]);
  const [erros, setErros] = useState<FamiliaErro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    const [a, b, c] = await Promise.all([
      supabase.rpc('fn_superadmin_painel', { p_dias: dias }),
      supabase.rpc('fn_superadmin_atencao'),
      supabase.rpc('fn_superadmin_erros', { p_dias: 7 }),
    ]);
    if (a.error) setErro(a.error.message);
    setP((a.data ?? null) as Painel | null);
    setAtencao((b.data ?? []) as Atencao[]);
    setErros((c.data ?? []) as FamiliaErro[]);
    setCarregando(false);
  }, [dias]);

  useEffect(() => { void carregar(); }, [carregar]);

  const errosNossos = erros.filter((e) => e.categoria === 'nosso' && ['pico', 'voltou', 'ativo'].includes(e.estado));
  const errosGraves = errosNossos.filter((e) => e.estado === 'pico' || e.estado === 'voltou');

  const ROTULO: Record<string, string> = {
    assinatura_atrasada: tDynamic('Assinatura atrasada'),
    teste_vencendo: tDynamic('Teste grátis vencendo'),
    teste_vencido: tDynamic('Teste vencido sem assinar'),
    sem_cardapio: tDynamic('Loja sem cardápio'),
    parou_de_vender: tDynamic('Parou de vender'),
    conta_sem_loja: tDynamic('Conta sem loja'),
    email_falhou: tDynamic('E-mail falhou'),
  };
  const COR: Record<number, string> = {
    1: 'bg-red-500/20 text-red-300', 2: 'bg-amber-500/20 text-amber-300', 3: 'bg-amber-500/10 text-amber-200',
    4: 'bg-sky-500/15 text-sky-300', 5: 'bg-orange-500/15 text-orange-300', 6: 'bg-violet-500/15 text-violet-300', 7: 'bg-red-500/10 text-red-300',
  };

  return (
    <div className="text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-['Sora'] text-2xl font-black tracking-tight">{tDynamic('Visão do negócio')}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {tDynamic('Lojas reais apenas.')} {p ? `${p.lojas_teste} ${tDynamic('lojas de teste e demonstração ficam fora destes números.')}` : ''}
          </p>
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

      {p && (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <Bloco icone={<Wallet size={16} />} titulo={tDynamic('Dinheiro')}>
            <Numero rotulo={`${tDynamic('Recebido')} (${p.dias}d)`} valor={real(Number(p.receita.recebido_periodo))}
              nota={`${p.receita.faturas_pagas_periodo} ${tDynamic('faturas pagas')}`} destaque />
            <Numero rotulo={tDynamic('Assinantes pagantes')} valor={String(p.assinaturas.pagantes)}
              nota={`${p.assinaturas.vitalicias} ${tDynamic('vitalícias')}`} />
            <Numero rotulo={tDynamic('Em teste grátis')} valor={String(p.assinaturas.em_teste)}
              nota={`${p.assinaturas.teste_vence_7d} ${tDynamic('vencem em 7 dias')}`} alerta={p.assinaturas.teste_vence_7d > 0} />
            <Numero rotulo={tDynamic('Atrasadas')} valor={String(p.assinaturas.atrasadas)}
              nota={`${p.receita.faturas_abertas_periodo} ${tDynamic('faturas em aberto')}`} alerta={p.assinaturas.atrasadas > 0} />
          </Bloco>

          <Bloco icone={<TrendingUp size={16} />} titulo={tDynamic('Crescimento')} link="/superadmin/cadastros">
            <Numero rotulo={`${tDynamic('Contas novas')} (${p.dias}d)`} valor={String(p.contas.novas)}
              nota={`${p.contas.com_loja} ${tDynamic('criaram loja')} · ${pct(p.contas.com_loja, p.contas.novas)}`} />
            <Numero rotulo={tDynamic('Lojas criadas')} valor={String(p.ativacao.criadas)}
              nota={`${p.ativacao.com_produto} ${tDynamic('com cardápio')} · ${p.ativacao.com_pedido} ${tDynamic('com pedido')}`} />
            <Numero rotulo={tDynamic('Ativação')} valor={pct(p.ativacao.com_pedido, p.ativacao.criadas)}
              nota={tDynamic('lojas novas que já receberam pedido')} />
            <Numero rotulo={tDynamic('Teste vencido sem assinar')} valor={String(p.assinaturas.teste_vencido)}
              alerta={p.assinaturas.teste_vencido > 0} />
          </Bloco>

          <Bloco icone={<Activity size={16} />} titulo={tDynamic('Operação das lojas')} link="/superadmin/tenants">
            <Numero rotulo={`${tDynamic('Pedidos')} (${p.dias}d)`} valor={p.uso.pedidos.toLocaleString('pt-BR')} />
            <Numero rotulo={tDynamic('Vendido pelas lojas')} valor={real(Number(p.uso.gmv))} />
            <Numero rotulo={tDynamic('Lojas vendendo')} valor={`${p.uso.lojas_com_pedido} / ${p.assinaturas.total}`} />
            <Numero rotulo={tDynamic('Paradas há 14 dias')} valor={String(p.risco.sem_pedido_14d)} alerta={p.risco.sem_pedido_14d > 0} />
          </Bloco>

          <Bloco icone={<HeartPulse size={16} />} titulo={tDynamic('Saúde da plataforma')} link="/superadmin/erros">
            <Numero rotulo={tDynamic('Erros nossos ativos')} valor={String(errosNossos.length)}
              nota={`${errosGraves.length} ${tDynamic('em pico ou que voltaram')}`} alerta={errosGraves.length > 0} />
            <Numero rotulo={tDynamic('E-mails (7d)')} valor={String(p.email_7d.enviados)}
              nota={`${p.email_7d.falhas} ${tDynamic('falhas')}`} alerta={p.email_7d.falhas > 0} />
            <Numero rotulo={tDynamic('Notas da assinatura pendentes')} valor={String(p.receita.notas_pendentes)} alerta={p.receita.notas_pendentes > 0} />
          </Bloco>
        </div>
      )}

      <h2 className="mb-2 flex items-center gap-2 font-['Sora'] text-lg font-black"><AlertTriangle size={18} /> {tDynamic('Precisa de atenção')} ({atencao.length})</h2>
      <p className="mb-3 text-xs text-slate-400">{tDynamic('Em ordem de dinheiro: atraso, teste vencendo, teste vencido, loja sem cardápio, loja parada, conta sem loja, e-mail falhado.')}</p>
      {atencao.length === 0 ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">{tDynamic('Nada pendente agora.')}</p>
      ) : (
        <div className="grid gap-2">
          {atencao.map((a, i) => {
            const destino = a.loja_id ? `/superadmin/lojas/${a.loja_id}` : a.tipo === 'conta_sem_loja' ? '/superadmin/cadastros' : '/superadmin/emails';
            return (
              <Link key={i} to={destino} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10">
                <div className="min-w-0">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${COR[a.prioridade] ?? 'bg-white/10'}`}>{ROTULO[a.tipo] ?? a.tipo}</span>
                  <p className="mt-1 truncate font-bold">{a.loja_nome}</p>
                  <p className="text-xs text-slate-400">{a.detalhe}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-500" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Bloco({ icone, titulo, link, children }: { icone: React.ReactNode; titulo: string; link?: string; children: React.ReactNode }) {
  const cabeca = <p className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">{icone}{titulo}{link && <ChevronRight size={14} />}</p>;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      {link ? <Link to={link}>{cabeca}</Link> : cabeca}
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Numero({ rotulo, valor, nota, destaque, alerta }: { rotulo: string; valor: string; nota?: string; destaque?: boolean; alerta?: boolean }) {
  return (
    <div className={`rounded-xl bg-black/20 p-3 ${alerta ? 'ring-1 ring-amber-400/60' : ''}`}>
      <p className="text-xs text-slate-400">{rotulo}</p>
      <p className={`mt-1 font-['Sora'] font-black ${destaque ? 'text-2xl text-emerald-300' : 'text-xl'} ${alerta ? 'text-amber-300' : ''}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-slate-500">{nota}</p>}
    </div>
  );
}

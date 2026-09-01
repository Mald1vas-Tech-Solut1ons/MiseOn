import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import {
  DollarSign, ShoppingBag, Ticket, Flame, AlertTriangle, Timer, ArrowRight,
  ClipboardList, UtensilsCrossed, TrendingUp, Boxes, Megaphone, LifeBuoy,
  Check, Circle, X, Rocket, BellRing, ChefHat, Trophy,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, type Pedido, type ProducaoPreparo } from '../../types';
import type { CtxLoja } from './AdminLayout';
import { useI18n } from '../../contexts/I18nContext';

interface DadosDia {
  pedidosHoje: Pedido[];
  insumosBaixos: { id: string; nome: string; quantidade_atual: number; estoque_minimo: number; unidade_medida: string }[];
  lotesVencendo: (ProducaoPreparo & { nomePreparo: string })[];
  waConversas: number;
  waHandoffs: number;
  waPedidos: number;
}

interface Onboarding {
  logo: boolean;
  cardapio: boolean;
  horarios: boolean;
  pagamentos: boolean;
  primeiraVenda: boolean;
}

const PASSOS_ONBOARDING: { chave: keyof Onboarding; titulo: string; descricao: string; to: string }[] = [
  { chave: 'logo', titulo: 'Dê a cara da sua loja', descricao: 'Suba a logo e escolha as cores da sua marca.', to: '/admin/loja' },
  { chave: 'cardapio', titulo: 'Monte o cardápio', descricao: 'Cadastre pelo menos um produto para vender.', to: '/admin/cardapio' },
  { chave: 'horarios', titulo: 'Defina os horários', descricao: 'Diga quando a loja abre e fecha.', to: '/admin/loja' },
  { chave: 'pagamentos', titulo: 'Configure os recebimentos', descricao: 'Conecte sua conta Efí para receber Pix e cartão.', to: '/admin/loja' },
  { chave: 'primeiraVenda', titulo: 'Faça a primeira venda', descricao: 'Compartilhe o link da loja e receba o primeiro pedido.', to: '/admin/loja' },
];

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard() {
  const { tDynamic } = useI18n();
  const ctx = useOutletContext<CtxLoja>();
  const { lojaId, lojaNome, lojaSlug, papel } = ctx;
  const [dados, setDados] = useState<DadosDia | null>(null);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [onboardingOculto, setOnboardingOculto] = useState(() => localStorage.getItem(`miseon_onb_ocultar_${lojaId}`) === '1');
  const [metricasCozinha, setMetricasCozinha] = useState<{
    meta_min: number;
    por_dia: { dia: string; media_total_min: number }[];
    ranking_operadores: { operador_nome: string; pedidos: number; media_min: number }[];
    media_hoje_min: number | null;
    pedidos_hoje: number | null;
  } | null>(null);

  useEffect(() => {
    supabase.rpc('fn_metricas_cozinha', { p_loja_id: lojaId }).then(({ data }) => {
      if (data) setMetricasCozinha(data as any);
    });
  }, [lojaId]);

  // Streak: dias consecutivos (terminando ontem, hoje só conta se já tiver
  // pedidos concluídos) com média dentro da meta — calculado no cliente.
  const streakCozinha = useMemo(() => {
    if (!metricasCozinha) return 0;
    const dias = [...metricasCozinha.por_dia].reverse();
    let streak = 0;
    for (const d of dias) {
      if (d.media_total_min <= metricasCozinha.meta_min) streak++;
      else break;
    }
    return streak;
  }, [metricasCozinha]);

  const carregar = async () => {
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
    const limiteVencimento = new Date(Date.now() + 6 * 3600e3).toISOString();

    const [
      { data: pedidosHoje },
      { data: insumosBaixos },
      { data: lotes },
      { data: loja },
      { count: qtdProdutos },
      { count: qtdHorarios },
      { count: qtdPedidosTotal },
      { data: preparosNomes },
      waConversasResult,
      { count: waPedidosCount }
    ] = await Promise.all([
      supabase.from('pedidos').select('id, numero, status, valor_total, criado_em, tipo_pedido, identificador_cliente')
        .eq('loja_id', lojaId).gte('criado_em', inicioHoje.toISOString()).order('criado_em', { ascending: false }),
      // comparação coluna x coluna não existe no PostgREST — traz os com mínimo
      // definido e filtra `quantidade_atual <= estoque_minimo` aqui no cliente
      supabase.from('insumos').select('id, nome, quantidade_atual, estoque_minimo, unidade_medida')
        .eq('loja_id', lojaId).eq('ativo', true).gt('estoque_minimo', 0)
        .order('quantidade_atual'),
      supabase.from('producoes_preparo').select('*')
        .eq('loja_id', lojaId).eq('status', 'ATIVO').not('vence_em', 'is', null)
        .lte('vence_em', limiteVencimento).order('vence_em'),
      supabase.from('lojas').select('logo_url, efi_payee_code, efi_titular_documento, efi_conta, pix_chave, aceita_online').eq('id', lojaId).single(),
      supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      supabase.from('horarios_funcionamento').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      supabase.from('insumos').select('id, nome').eq('loja_id', lojaId).eq('is_preparo', true),
      // WA Metrics
      supabase.from('chat_conversations').select('id, ia_ativa').eq('loja_id', lojaId).eq('canal', 'WHATSAPP').gte('criado_em', inicioHoje.toISOString()),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId).eq('origem', 'whatsapp').gte('criado_em', inicioHoje.toISOString()),
    ]);

    const nomes = new Map((preparosNomes ?? []).map((p) => [p.id, p.nome]));
    const waConvs = (waConversasResult.data || []) as any[];
    
    setDados({
      pedidosHoje: (pedidosHoje as Pedido[]) ?? [],
      insumosBaixos: ((insumosBaixos as DadosDia['insumosBaixos']) ?? [])
        .filter((i) => Number(i.quantidade_atual) <= Number(i.estoque_minimo))
        .slice(0, 50),
      lotesVencendo: ((lotes as ProducaoPreparo[]) ?? []).map((l) => ({ ...l, nomePreparo: nomes.get(l.preparo_id) ?? 'Preparo' })),
      waConversas: waConvs.length,
      waHandoffs: waConvs.filter(c => !c.ia_ativa).length,
      waPedidos: waPedidosCount ?? 0,
    });

    // Cartão e Pix têm mecanismos de repasse SEPARADOS e independentes:
    //   cartão → efi_payee_code
    //   Pix    → efi_titular_documento + efi_conta (split)
    // Ter um NÃO implica ter o outro. A regra antiga aceitava qualquer um dos
    // dois e dava "pagamentos ✓" — então uma loja com o cartão configurado e o
    // Pix sem repasse aparecia como pronta, enquanto todo Pix caía na conta da
    // plataforma. O checklist afirmava o que não era verdade.
    // Só está pronto quem tem repasse para TODO meio online que aceita.
    const cartaoOk = !!loja?.efi_payee_code;
    const pixOk = !!(loja?.efi_titular_documento && loja?.efi_conta);
    const pagamentosOk = !(loja?.aceita_online ?? true) || (cartaoOk && pixOk);
    setOnboarding({
      logo: !!loja?.logo_url,
      cardapio: (qtdProdutos ?? 0) > 0,
      horarios: (qtdHorarios ?? 0) > 0,
      pagamentos: pagamentosOk,
      primeiraVenda: (qtdPedidosTotal ?? 0) > 0,
    });
  };

  useEffect(() => {
    if (papel !== 'admin') return;
    carregar();
    const canal = supabase
      .channel(`dashboard-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId, papel]);

  const resumo = useMemo(() => {
    const lista = dados?.pedidosHoje ?? [];
    const validos = lista.filter((p) => p.status !== 'CANCELADO');
    const faturamento = validos.reduce((s, p) => s + Number(p.valor_total), 0);
    return {
      faturamento,
      qtd: validos.length,
      ticket: validos.length > 0 ? faturamento / validos.length : 0,
      abertos: lista.filter((p) => !['FINALIZADO', 'CANCELADO'].includes(p.status)).length,
      aguardando: lista.filter((p) => p.status === 'NOVO').length,
    };
  }, [dados]);

  const passosFeitos = onboarding ? PASSOS_ONBOARDING.filter((p) => onboarding[p.chave]).length : 0;
  const onboardingCompleto = passosFeitos === PASSOS_ONBOARDING.length;
  const mostrarOnboarding = onboarding && !onboardingCompleto && !onboardingOculto;

  const ocultarOnboarding = () => {
    localStorage.setItem(`miseon_onb_ocultar_${lojaId}`, '1');
    setOnboardingOculto(true);
  };

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Operador e entregador não veem números do negócio — vão direto para a operação.
  if (papel !== 'admin') return <Navigate to="/admin/pedidos" replace />;

  if (!dados) return <div className="p-8 text-center text-gray-400">{tDynamic('Preparando o seu dia…')}</div>;

  const lotesVencidos = dados.lotesVencendo.filter((l) => new Date(l.vence_em!) <= new Date());
  const lotesQuaseVencendo = dados.lotesVencendo.filter((l) => new Date(l.vence_em!) > new Date());

  return (
    <div className="mx-auto max-w-5xl p-4 pb-28 lg:pb-12">
      {/* ── Saudação ── */}
      <div data-tour="tour-dashboard-header" className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{hoje}</p>
        <h2 className="mt-1 text-2xl font-black dark:text-gray-100">{saudacao()}, {lojaNome} 👋</h2>
      </div>

      {/* ── Onboarding (primeiros passos) ── */}
      {mostrarOnboarding && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--cor-primaria)]/30 bg-white shadow-sm dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[var(--cor-primaria)]/10 p-2 text-[var(--cor-primaria)]"><Rocket size={18} /></div>
              <div>
                <p className="text-sm font-black dark:text-gray-100">{tDynamic('Deixe sua loja pronta para vender')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{passosFeitos} de {PASSOS_ONBOARDING.length} passos concluídos</p>
              </div>
            </div>
            <button onClick={ocultarOnboarding} title="Ocultar (você pode continuar depois)" className="rounded-lg p-1.5 text-gray-300 hover:text-gray-500"><X size={16} /></button>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800">
            <div className="h-1.5 rounded-r-full bg-[var(--cor-primaria)] transition-all" style={{ width: `${(passosFeitos / PASSOS_ONBOARDING.length) * 100}%` }} />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {PASSOS_ONBOARDING.map((passo) => {
              const feito = !!onboarding?.[passo.chave];
              return (
                <Link key={passo.chave} to={passo.to} className={`flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-gray-50 dark:hover:bg-white/5 ${feito ? 'opacity-55' : ''}`}>
                  <div className="flex items-center gap-3">
                    {feito
                      ? <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"><Check size={13} /></span>
                      : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 text-gray-300 dark:border-gray-700"><Circle size={8} /></span>}
                    <div>
                      <p className={`text-sm font-semibold dark:text-gray-100 ${feito ? 'line-through' : ''}`}>{passo.titulo}</p>
                      {!feito && <p className="text-[11px] text-gray-400">{passo.descricao}</p>}
                    </div>
                  </div>
                  {!feito && <ArrowRight size={15} className="shrink-0 text-[var(--cor-primaria)]" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Alerta: pedidos aguardando aceite ── */}
      {resumo.aguardando > 0 && (
        <Link to="/admin/pedidos" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-orange-300 bg-orange-50 px-5 py-4 shadow-sm transition hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-900/15 dark:hover:bg-orange-900/25">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
              <BellRing size={18} />
              <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-orange-400" />
            </span>
            <div>
              <p className="text-sm font-black text-orange-700 dark:text-orange-400">
                {resumo.aguardando} pedido{resumo.aguardando > 1 ? 's' : ''} aguardando aceite!
              </p>
              <p className="text-xs text-orange-600/80 dark:text-orange-400/70">{tDynamic('O cliente está esperando a confirmação da loja.')}</p>
            </div>
          </div>
          <ArrowRight size={18} className="shrink-0 text-orange-500" />
        </Link>
      )}

      {/* ── KPIs do dia ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400"><DollarSign size={12} /> {tDynamic('Vendas hoje')}</p>
          <p className="mt-1.5 text-xl font-black dark:text-gray-100">{fmt(resumo.faturamento)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400"><ShoppingBag size={12} /> {tDynamic('Pedidos hoje')}</p>
          <p className="mt-1.5 text-xl font-black dark:text-gray-100">{resumo.qtd}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400"><Ticket size={12} /> {tDynamic('Ticket médio')}</p>
          <p className="mt-1.5 text-xl font-black dark:text-gray-100">{fmt(resumo.ticket)}</p>
        </div>
        <Link to="/admin/pedidos" className="group rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-[var(--cor-primaria)]/40 dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
            <Flame size={12} /> {tDynamic('Em andamento')}
            {resumo.abertos > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-xl font-black dark:text-gray-100">
            {resumo.abertos}
            <ArrowRight size={14} className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--cor-primaria)]" />
          </p>
        </Link>
      </div>

      {/* ── WhatsApp Hoje ── */}
      {(dados.waConversas > 0 || dados.waPedidos > 0) && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 shadow-sm dark:border-green-900/50 dark:bg-green-900/15">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.83 9.83 0 0 0 12.04 2m0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23m4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28"/></svg>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-black text-green-900 dark:text-green-100">
                WhatsApp Hoje
                {dados.waConversas > 0 && (
                  <span className="flex items-center gap-0.5 rounded-full bg-green-200/50 px-1.5 py-0.5 text-[10px] font-black text-green-800 dark:bg-green-900/50 dark:text-green-300">
                    {Math.round((dados.waPedidos / dados.waConversas) * 100)}% de conversão
                  </span>
                )}
              </p>
              <p className="text-xs text-green-800/70 dark:text-green-100/60">
                {dados.waConversas} conversas · {dados.waConversas - dados.waHandoffs} resolvidas por IA · {dados.waPedidos} pedidos gerados
              </p>
            </div>
          </div>
          <Link to="/admin/chat" className="shrink-0 text-sm font-bold text-green-700 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">
            Abrir Chat
          </Link>
        </div>
      )}


      {/* ── Alertas de operação ── */}
      {(dados.insumosBaixos.length > 0 || dados.lotesVencendo.length > 0) && (
        <div className="mb-5 grid gap-3 lg:grid-cols-2">
          {dados.insumosBaixos.length > 0 && (
            <Link to="/admin/estoque" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm transition hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-900/15 dark:hover:bg-amber-900/25">
              <p className="flex items-center gap-2 text-sm font-black text-amber-700 dark:text-amber-400">
                <Boxes size={15} /> {dados.insumosBaixos.length} insumo{dados.insumosBaixos.length > 1 ? 's' : ''} com estoque baixo
              </p>
              <div className="mt-2 space-y-1">
                {dados.insumosBaixos.slice(0, 3).map((i) => (
                  <p key={i.id} className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    • {i.nome}: <b>{Number(i.quantidade_atual)} {i.unidade_medida}</b> (mínimo {Number(i.estoque_minimo)})
                  </p>
                ))}
                {dados.insumosBaixos.length > 3 && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">+ {dados.insumosBaixos.length - 3} outros — ver Central de Compras</p>}
              </div>
            </Link>
          )}
          {dados.lotesVencendo.length > 0 && (
            <Link to="/admin/estoque" className="rounded-2xl border border-red-300 bg-red-50 p-4 shadow-sm transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/15 dark:hover:bg-red-900/25">
              <p className="flex items-center gap-2 text-sm font-black text-red-600 dark:text-red-400">
                <Timer size={15} /> {tDynamic('Validade de preparos')}
              </p>
              <div className="mt-2 space-y-1">
                {lotesVencidos.slice(0, 2).map((l) => (
                  <p key={l.id} className="text-xs font-semibold text-red-600 dark:text-red-400">
                    <AlertTriangle size={11} className="mr-1 inline" />{l.nomePreparo}: lote VENCIDO — descarte no Estoque
                  </p>
                ))}
                {lotesQuaseVencendo.slice(0, 2).map((l) => (
                  <p key={l.id} className="text-xs text-red-700/80 dark:text-red-300/80">
                    • {l.nomePreparo}: vence {new Date(l.vence_em!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                ))}
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── Cozinha hoje (fluxo passa-bastão: tempo médio, meta, ranking) ── */}
      {metricasCozinha && metricasCozinha.pedidos_hoje != null && (
        <Link to="/admin/kds" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-orange-300 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
              <ChefHat size={20} />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-black dark:text-gray-100">
                Cozinha hoje
                {streakCozinha > 0 && (
                  <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Trophy size={10} /> {streakCozinha}d na meta
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {metricasCozinha.media_hoje_min != null
                  ? `${metricasCozinha.media_hoje_min}min de média · meta ${metricasCozinha.meta_min}min · ${metricasCozinha.pedidos_hoje} pedido(s)`
                  : 'Ainda sem pedidos concluídos hoje'}
                {metricasCozinha.ranking_operadores[0] && ` · 🥇 ${metricasCozinha.ranking_operadores[0].operador_nome}`}
              </p>
            </div>
          </div>
          <ArrowRight size={18} className="shrink-0 text-gray-300" />
        </Link>
      )}

      {/* ── Últimos pedidos de hoje ── */}
      <div className="mb-5 rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="text-sm font-black dark:text-gray-100">{tDynamic('Últimos pedidos de hoje')}</p>
          <Link to="/admin/pedidos" className="flex items-center gap-1 text-xs font-bold text-[var(--cor-primaria)]">Ver todos <ArrowRight size={13} /></Link>
        </div>
        {dados.pedidosHoje.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            {tDynamic('Nenhum pedido ainda hoje. Compartilhe o link da loja:')} <b className="text-gray-600 dark:text-gray-300">{window.location.origin}/{lojaSlug}</b>
          </p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {dados.pedidosHoje.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-gray-400">#{p.numero}</span>
                  <span className="truncate text-sm font-semibold dark:text-gray-100">{p.identificador_cliente}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.status === 'CANCELADO' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : p.status === 'FINALIZADO' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>{p.status}</span>
                  <span className="text-sm font-bold dark:text-gray-100">{fmt(Number(p.valor_total))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Atalhos ── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { to: '/admin/pedidos', icon: <ClipboardList size={18} />, label: 'Pedidos' },
          { to: '/admin/cardapio', icon: <UtensilsCrossed size={18} />, label: 'Cardápio' },
          { to: '/admin/financeiro', icon: <TrendingUp size={18} />, label: 'Financeiro' },
          { to: '/admin/estoque', icon: <Boxes size={18} />, label: 'Estoque' },
          { to: '/admin/marketing', icon: <Megaphone size={18} />, label: 'Marketing' },
          { to: '/admin/ajuda', icon: <LifeBuoy size={18} />, label: 'Ajuda' },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-3.5 text-gray-500 shadow-sm transition hover:border-[var(--cor-primaria)]/40 hover:text-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {a.icon}
            <span className="text-[11px] font-bold">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

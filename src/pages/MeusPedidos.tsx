import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bike, ChevronLeft, Clock3, Compass, LogIn, Package, Sparkles, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmt, type Loja, type Pedido, type StatusPedido } from '../types';
import { aplicarTema, obterTemaPreferido, type PreferenciaTema } from '../lib/tema';
import { fonteFamilia, obterFundoLojaPorTema, obterTokensLoja } from '../lib/personalizacao';
import ThemeToggle from '../components/ThemeToggle';
import MiseOnLoader from '../components/MiseOnLoader';

const STATUS_LABEL: Record<StatusPedido, string> = {
  NOVO: 'Recebido',
  ACEITO: 'Aceito',
  PREPARANDO: 'Em preparo',
  PRONTO: 'Pronto',
  EM_ROTA: 'Em rota',
  FINALIZADO: 'Entregue',
  CANCELADO: 'Cancelado',
};

const STATUS_TOM: Record<StatusPedido, string> = {
  NOVO: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  ACEITO: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  PREPARANDO: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  PRONTO: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  EM_ROTA: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
  FINALIZADO: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  CANCELADO: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

const STATUS_PESO: Record<StatusPedido, number> = {
  NOVO: 1,
  ACEITO: 2,
  PREPARANDO: 3,
  PRONTO: 4,
  EM_ROTA: 5,
  FINALIZADO: 6,
  CANCELADO: 0,
};

const entrar = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });

function descricaoStatus(pedido: Pedido) {
  if (pedido.status === 'NOVO') return 'Recebemos seu pedido e a loja já foi avisada.';
  if (pedido.status === 'ACEITO') return 'Pedido aceito e seguindo para a cozinha.';
  if (pedido.status === 'PREPARANDO') return 'A cozinha está preparando seu pedido agora.';
  if (pedido.status === 'PRONTO') return pedido.tipo_pedido === 'DELIVERY'
    ? (pedido.rota_id ? 'Pedido embalado, aguardando o início da sua entrega.' : 'Pedido pronto, aguardando despacho.')
    : 'Pedido pronto para retirada.';
  if (pedido.status === 'EM_ROTA') return 'Seu entregador já iniciou a sua entrega.';
  if (pedido.status === 'FINALIZADO') return 'Pedido concluído com sucesso.';
  return 'Pedido cancelado pela loja.';
}

export default function MeusPedidos() {
  const { slug } = useParams();
  const [logado, setLogado] = useState<boolean | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loja, setLoja] = useState<Partial<Loja> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [saldoCashback, setSaldoCashback] = useState(0);
  const [temaCliente, setTemaCliente] = useState<PreferenciaTema>(() => obterTemaPreferido());

  useEffect(() => {
    if (!loja) return;
    const padrao = loja.tema_cardapio === 'escuro' ? 'escuro' : 'claro';
    setTimeout(() => setTemaCliente(obterTemaPreferido(padrao)), 0);
    const sincronizarTema = (event: Event) => {
      const tema = (event as CustomEvent<{ tema: PreferenciaTema }>).detail?.tema;
      if (tema === 'claro' || tema === 'escuro') setTemaCliente(tema);
    };
    window.addEventListener('miseon:tema', sincronizarTema as EventListener);
    return () => window.removeEventListener('miseon:tema', sincronizarTema as EventListener);
  }, [loja?.slug, loja?.tema_cardapio]);

  useEffect(() => {
    if (!loja) return;
    const raiz = document.documentElement;
    const fundo = obterFundoLojaPorTema(temaCliente, loja);
    const tokens = obterTokensLoja(fundo, temaCliente, loja.cor_texto || loja.cor_primaria || '#FC5B24');
    raiz.style.setProperty('--cor-fundo', fundo);
    raiz.style.setProperty('--cor-primaria', loja.cor_primaria || '#FC5B24');
    raiz.style.setProperty('--cor-secundaria', loja.cor_secundaria || '#0A5CC4');
    raiz.style.setProperty('--fonte-loja', fonteFamilia(loja.fonte));
    raiz.style.setProperty('--cor-texto', tokens.texto);
    raiz.style.setProperty('--cor-texto-suave', tokens.textoSuave);
    raiz.style.setProperty('--cor-texto-fraco', tokens.textoFraco);
    raiz.style.setProperty('--cor-surface', tokens.surface);
    raiz.style.setProperty('--cor-surface-muted', tokens.surfaceMuted);
    raiz.style.setProperty('--cor-card', tokens.card);
    raiz.style.setProperty('--cor-borda', tokens.border);
    raiz.style.setProperty('--cor-borda-forte', tokens.borderStrong);
    raiz.style.setProperty('--cor-destaque', tokens.destaque);
    aplicarTema(temaCliente);
  }, [loja, temaCliente]);

  useEffect(() => {
    if (!slug) return;
    let userId: string | null = null;

    const carregar = async (silencioso = false) => {
      if (!silencioso) setCarregando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLogado(false);
        setPedidos([]);
        setCarregando(false);
        return;
      }

      userId = user.id;
      setLogado(true);

      const { data: lojaData } = await supabase
        .from('lojas_publicas')
        .select('id, slug, nome, logo_url, cor_primaria, cor_secundaria, cor_texto, cor_fundo_claro, cor_fundo_escuro, fonte, tema_cardapio')
        .eq('slug', slug)
        .maybeSingle();

      if (!lojaData) {
        setCarregando(false);
        return;
      }

      setLoja(lojaData);

      const [{ data }, { data: clienteRow }] = await Promise.all([
        supabase.from('pedidos').select('*, itens_pedido(*)')
          .eq('loja_id', lojaData.id).eq('cliente_user_id', user.id).order('criado_em', { ascending: false }),
        supabase.from('clientes').select('id').eq('loja_id', lojaData.id).eq('user_id', user.id).maybeSingle(),
      ]);

      setPedidos((data as Pedido[]) ?? []);
      if (clienteRow?.id) {
        const { data: saldoRow } = await supabase.from('cashback_saldos').select('saldo').eq('cliente_id', clienteRow.id).maybeSingle();
        setSaldoCashback(Number(saldoRow?.saldo ?? 0));
      }
      setCarregando(false);
    };

    carregar();

    const authSub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== userId) carregar();
    });

    // Realtime com reconexão automática + polling de segurança + sync ao voltar pra aba
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let tentativaReconexao: ReturnType<typeof setTimeout> | null = null;
    let ativo = true;

    const assinar = () => {
      if (!ativo) return;
      if (canal) supabase.removeChannel(canal);
      canal = supabase
        .channel(`meus-pedidos-${slug}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
          carregar(true);
        })
        .subscribe((status) => {
          if (!ativo) return;
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (tentativaReconexao) clearTimeout(tentativaReconexao);
            tentativaReconexao = setTimeout(assinar, 4000);
          }
        });
    };
    assinar();

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') carregar(true);
    }, 20000);

    const aoVoltar = () => { if (document.visibilityState === 'visible') { carregar(true); assinar(); } };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', aoVoltar);

    return () => {
      ativo = false;
      if (tentativaReconexao) clearTimeout(tentativaReconexao);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', aoVoltar);
      authSub.data.subscription.unsubscribe();
      if (canal) supabase.removeChannel(canal);
    };
  }, [slug]);

  const ativos = useMemo(
    () => pedidos.filter((pedido) => !['FINALIZADO', 'CANCELADO'].includes(pedido.status)).sort((a, b) => STATUS_PESO[b.status] - STATUS_PESO[a.status]),
    [pedidos],
  );
  const historico = useMemo(
    () => pedidos.filter((pedido) => ['FINALIZADO', 'CANCELADO'].includes(pedido.status)),
    [pedidos],
  );

  const ultimoPedidoSalvo = useMemo(() => {
    if (!slug) return null;
    try {
      const bruto = localStorage.getItem(`miseon_ultimo_pedido_${slug}`);
      return bruto ? JSON.parse(bruto) as { pedidoId: string; numero: number } : null;
    } catch {
      return null;
    }
  }, [slug]);

  return (
    <div className="loja-marca min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b px-4 py-4 shadow-sm backdrop-blur-md" style={{ background: 'color-mix(in srgb, var(--cor-surface) 88%, transparent)', borderColor: 'var(--cor-borda)' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
          <Link to={`/${slug}`} className="rounded-full p-2" style={{ color: 'var(--cor-texto-suave)', background: 'var(--cor-destaque)' }}>
            <ChevronLeft size={18} />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--cor-texto-fraco)' }}>Central do cliente</p>
            <h1 className="font-black" style={{ color: 'var(--cor-texto)' }}>Meus pedidos</h1>
          </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/lojas" className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)', background: 'var(--cor-surface)' }}>
              <Compass size={14} /> Lojas
            </Link>
            <ThemeToggle className="rounded-full border p-2" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-5">
        {logado === false && (
          <div className="mt-6 rounded-3xl border border-dashed p-6 text-center" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda-forte)' }}>
            <p className="text-lg font-bold" style={{ color: 'var(--cor-texto)' }}>Entre para ver seus pedidos e acompanhar tudo em tempo real.</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
              Seu histórico, pedidos em preparo e entregas em andamento ficam centralizados aqui.
            </p>
            <button onClick={entrar} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor-primaria)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110">
              <LogIn size={16} /> Entrar com Google
            </button>
          </div>
        )}

        {carregando && logado !== false && (
          <div className="py-12 flex justify-center">
            <MiseOnLoader status="Carregando seus pedidos..." rows={2} />
          </div>
        )}

        {logado && !carregando && (
          <div className="space-y-6">
            <section className="rounded-3xl border p-5 shadow-sm" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl p-2.5" style={{ background: 'var(--cor-destaque)', color: 'var(--cor-primaria)' }}>
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>Acompanhe tudo daqui, sem depender de ficar na tela do pedido.</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                      Sempre que a loja aceitar, preparar, despachar ou concluir uma entrega, esta central é atualizada automaticamente.
                    </p>
                  </div>
                </div>
                {ultimoPedidoSalvo && (
                  <Link to={`/pedido/${ultimoPedidoSalvo.pedidoId}`} className="rounded-2xl bg-[var(--cor-primaria)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110">
                    Retomar pedido #{ultimoPedidoSalvo.numero}
                  </Link>
                )}
              </div>
            </section>

            {saldoCashback > 0 && (
              <section className="flex items-center gap-3 rounded-3xl border p-4 shadow-sm" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
                <div className="rounded-2xl p-2.5" style={{ background: 'var(--cor-destaque)', color: 'var(--cor-primaria)' }}>
                  <Wallet size={18} />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>Você tem {fmt(saldoCashback)} de cashback</p>
                  <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>Use como desconto no seu próximo pedido, direto no checkout.</p>
                </div>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Bike size={18} className="text-[var(--cor-primaria)]" />
                <h2 className="font-bold" style={{ color: 'var(--cor-texto)' }}>Em andamento</h2>
              </div>
              {ativos.length === 0 ? (
                <div className="rounded-3xl border p-6 text-center" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
                  <Package size={28} className="mx-auto mb-3" style={{ color: 'var(--cor-texto-fraco)' }} />
                  <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>Nenhum pedido em andamento no momento.</p>
                  <Link to="/lojas" className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: 'var(--cor-destaque)', color: 'var(--cor-texto)' }}>
                    <Compass size={15} /> Explorar restaurantes
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {ativos.map((pedido) => (
                    <Link key={pedido.id} to={`/pedido/${pedido.id}`} className="block rounded-3xl border p-4 shadow-sm transition hover:shadow-md" style={{ background: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-black" style={{ color: 'var(--cor-texto)' }}>#{pedido.numero}</span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TOM[pedido.status]}`}>{STATUS_LABEL[pedido.status]}</span>
                          </div>
                          <p className="mt-2 text-sm" style={{ color: 'var(--cor-texto-suave)' }}>{descricaoStatus(pedido)}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--cor-texto-fraco)' }}>
                            <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {new Date(pedido.criado_em).toLocaleString('pt-BR')}</span>
                            <span>{pedido.itens_pedido?.length ?? 0} item(ns)</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black" style={{ color: 'var(--cor-primaria)' }}>{fmt(Number(pedido.valor_total))}</p>
                          <span className="mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'var(--cor-destaque)', color: 'var(--cor-texto)' }}>
                            {pedido.status === 'EM_ROTA' ? 'Acompanhar ao vivo' : 'Ver detalhes'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Package size={18} className="text-[var(--cor-primaria)]" />
                <h2 className="font-bold" style={{ color: 'var(--cor-texto)' }}>Histórico</h2>
              </div>
              {historico.length === 0 ? (
                <div className="rounded-3xl border p-6 text-center" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
                  <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>Seu histórico ainda não tem pedidos finalizados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historico.map((pedido) => (
                    <Link key={pedido.id} to={`/pedido/${pedido.id}`} className="block rounded-3xl border p-4 shadow-sm transition hover:shadow-md" style={{ background: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black" style={{ color: 'var(--cor-texto)' }}>#{pedido.numero}</span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TOM[pedido.status]}`}>{STATUS_LABEL[pedido.status]}</span>
                          </div>
                          <p className="mt-1 text-xs" style={{ color: 'var(--cor-texto-fraco)' }}>{new Date(pedido.criado_em).toLocaleString('pt-BR')}</p>
                        </div>
                        <span className="font-bold" style={{ color: 'var(--cor-texto)' }}>{fmt(Number(pedido.valor_total))}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

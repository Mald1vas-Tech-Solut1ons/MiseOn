import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Store, Link2, Percent, ClipboardList, Search, Loader2, Save,
  AlertTriangle, Package, ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, type Pedido, type Produto } from '../../types';
import { STATUS_LABEL } from '../../components/pedidos/constants';
import { useToast } from '../../components/ui/Toast';
import { MiseOnLoader } from '../../components/MiseOnLoader';
import { IfoodOnboarding } from '../../components/admin/IfoodOnboarding';
import type { CtxLoja } from './AdminLayout';

import { useI18n } from '../../contexts/I18nContext';
type Aba = 'conexao' | 'depara' | 'pedidos';

interface LojaIfood {
  plano_tipo?: string;
  ifood_merchant_id: string;
  ifood_addon_ativo: boolean;
  ifood_taxa_pct: number;
  ifood_taxa_fixa: number;
  ifood_sync_cardapio: boolean;
  ifood_sync_preco_auto: boolean;
  ifood_sync_disponibilidade: boolean;
  ifood_sync_status_pedido: boolean;
  ifood_pausar_sem_estoque: boolean;
  ifood_confirmar_automatico: boolean;
}

const LIMIAR: LojaIfood = {
  plano_tipo: 'Básico',
  ifood_merchant_id: '',
  ifood_addon_ativo: false,
  ifood_taxa_pct: 0,
  ifood_taxa_fixa: 0,
  ifood_sync_cardapio: false,
  ifood_sync_preco_auto: false,
  ifood_sync_disponibilidade: false,
  ifood_sync_status_pedido: false,
  ifood_pausar_sem_estoque: false,
  ifood_confirmar_automatico: true,
};

export default function Ifood() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const toast = useToast();
  const [aba, setAba] = useState<Aba>('conexao');
  const [carregando, setCarregando] = useState(true);
  const [loja, setLoja] = useState<LojaIfood>(LIMIAR);
  const [salvandoTaxas, setSalvandoTaxas] = useState(false);

  const carregarLoja = useCallback(async () => {
    const { data } = await supabase
      .from('lojas')
      // `plano_tipo` não existe no banco — a coluna é `plano`. Sem o alias este
      // SELECT falhava e a tela de integração nunca carregava o merchant_id.
      .select('plano_tipo:plano, ifood_merchant_id, ifood_addon_ativo, ifood_taxa_pct, ifood_taxa_fixa, ifood_sync_cardapio, ifood_sync_preco_auto, ifood_sync_disponibilidade, ifood_sync_status_pedido, ifood_pausar_sem_estoque, ifood_confirmar_automatico')
      .eq('id', lojaId)
      .single();
    if (data) {
      setLoja({
        plano_tipo: data.plano_tipo ?? 'Básico',
        ifood_merchant_id: data.ifood_merchant_id ?? '',
        ifood_addon_ativo: data.ifood_addon_ativo ?? false,
        ifood_taxa_pct: Number(data.ifood_taxa_pct ?? 0),
        ifood_taxa_fixa: Number(data.ifood_taxa_fixa ?? 0),
        ifood_sync_cardapio: data.ifood_sync_cardapio ?? false,
        ifood_sync_preco_auto: data.ifood_sync_preco_auto ?? false,
        ifood_sync_disponibilidade: data.ifood_sync_disponibilidade ?? false,
        ifood_sync_status_pedido: data.ifood_sync_status_pedido ?? false,
        ifood_pausar_sem_estoque: data.ifood_pausar_sem_estoque ?? false,
        ifood_confirmar_automatico: data.ifood_confirmar_automatico ?? true,
      });
    }
    setCarregando(false);
  }, [lojaId]);

  useEffect(() => { setTimeout(carregarLoja, 0); }, [carregarLoja]);

  // Adaptador para o IfoodOnboarding (componente compartilhado com Configurações da Loja)
  const setValor = (campo: keyof LojaIfood, valor: any) =>
    setLoja((l) => ({ ...l, [campo]: valor }));

  /** Preferencia salva no toque, sem botao: sao interruptores, nao formulario.
   *  Estado otimista com rollback — se o banco recusar, a chave volta. */
  const alternarPreferencia = async (campo: keyof LojaIfood, valor: boolean) => {
    const anterior = loja[campo];
    setLoja((l) => ({ ...l, [campo]: valor }));
    const { error } = await supabase.from('lojas').update({ [campo]: valor }).eq('id', lojaId);
    if (error) {
      setLoja((l) => ({ ...l, [campo]: anterior }));
      toast('Não deu para salvar: ' + error.message, 'erro');
    }
  };

  const salvarTaxas = async () => {
    setSalvandoTaxas(true);
    const { error } = await supabase.from('lojas').update({
      ifood_taxa_pct: Number(loja.ifood_taxa_pct || 0),
      ifood_taxa_fixa: Number(loja.ifood_taxa_fixa || 0),
    }).eq('id', lojaId);
    setSalvandoTaxas(false);
    if (error) {
      toast('Erro ao salvar taxas: ' + error.message, 'erro');
    } else {
      toast('Taxas do iFood salvas!', 'sucesso');
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center pt-24">
        <MiseOnLoader status="Carregando integração iFood" rows={3} />
      </div>
    );
  }

  const conectado = !!loja.ifood_merchant_id;

  return (
    <div className="px-4 py-6">
      {/* ── Cabeçalho ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/25">
            <Store size={24} />
          </div>
          <div>
            <h1 className="font-['Sora'] text-2xl font-extrabold text-gray-900 dark:text-white">{tDynamic('Integração iFood')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tDynamic('Pedidos do iFood direto no seu PDV, com margem protegida.')}
            </p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black uppercase tracking-wide ${
          conectado
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
        }`}>
          <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-emerald-500 shadow-[0_0_8px_#22c55e]' : 'bg-gray-400'}`} />
          {conectado ? 'Conectado' : 'Não vinculado'}
        </span>
      </div>

      {/* ── Abas ── */}
      <div className="mb-6 flex flex-wrap gap-2 pb-1">
        <button
          data-tour="tour-ifood-aba-credenciais"
          onClick={() => setAba('conexao')}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
            aba === 'conexao'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
              : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          <Link2 size={15} /> {tDynamic('Conexão e Taxas')}
        </button>
        <button
          data-tour="tour-ifood-aba-depara"
          onClick={() => setAba('depara')}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
            aba === 'depara'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
              : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          <Package size={15} /> {tDynamic('De-Para de Produtos')}
        </button>
        <button
          onClick={() => setAba('pedidos')}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
            aba === 'pedidos'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
              : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          <ClipboardList size={15} /> Pedidos iFood
        </button>
      </div>

      {aba === 'conexao' && (
        <div className="space-y-4">
          <IfoodOnboarding
            lojaId={lojaId}
            form={loja}
            setValor={setValor}
            onSuccess={carregarLoja}
          />
          {conectado && (
            <div className="mx-auto max-w-xl space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-white">{tDynamic('O que o MiseOn controla no iFood')}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {tDynamic('Cada item é independente. Tudo começa desligado — nada é alterado no seu iFood sem você ligar aqui.')}
                </p>
              </div>

              {([
                ['ifood_addon_ativo', 'Integração ativa',
                 'Interruptor geral. Desligado, nada é enviado nem recebido.'],
                ['ifood_confirmar_automatico', 'Confirmar pedido automaticamente',
                 'O iFood exige confirmação em até 8 minutos. Desligado, você confirma na mão e assume o prazo.'],
                ['ifood_sync_status_pedido', 'Avançar o pedido no iFood',
                 'Marcou "em preparo" ou despachou aqui? O cliente vê no app dele. Desligado, ele fica sem acompanhamento.'],
                ['ifood_sync_cardapio', 'Enviar cardápio para o iFood',
                 'Categorias e itens daqui passam a alimentar o cardápio de lá. Desligado, você mantém os dois na mão.'],
                ['ifood_sync_preco_auto', 'Sincronizar preço',
                 'Preço alterado aqui vai para o iFood. Muitos lojistas cobram mais lá por causa da comissão — nesse caso, deixe desligado.'],
                ['ifood_sync_disponibilidade', 'Sincronizar disponibilidade',
                 'Pausar um item aqui pausa lá também.'],
                ['ifood_pausar_sem_estoque', 'Pausar quando o estoque acabar',
                 'Insumo zerou na ficha técnica? O item sai do ar no iFood sozinho, antes de alguém pedir o que não tem.'],
              ] as [keyof LojaIfood, string, string][]).map(([campo, titulo, ajuda]) => {
                const ligado = !!loja[campo];
                const bloqueado = campo !== 'ifood_addon_ativo' && !loja.ifood_addon_ativo;
                return (
                  <button
                    key={campo}
                    onClick={() => !bloqueado && alternarPreferencia(campo, !ligado)}
                    disabled={bloqueado}
                    className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition ${
                      bloqueado
                        ? 'cursor-not-allowed border-gray-200 opacity-45 dark:border-gray-800'
                        : ligado
                        ? 'border-red-500 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-gray-900 dark:text-gray-100">{titulo}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">{ajuda}</span>
                    </span>
                    <span className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                      ligado ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}>
                      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${ligado ? 'translate-x-5' : ''}`} />
                    </span>
                  </button>
                );
              })}

              <button
                onClick={salvarTaxas}
                disabled={salvandoTaxas}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-3.5 text-base font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50"
              >
                {salvandoTaxas ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Salvar Taxas
              </button>
            </div>
          )}
        </div>
      )}

      {aba === 'depara' && <DeParaProdutos lojaId={lojaId} loja={loja} />}
      {aba === 'pedidos' && <PedidosIfood lojaId={lojaId} onIrParaDepara={() => setAba('depara')} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ABA 2 — De-Para de Produtos (pdv_code ↔ externalCode do iFood)
   ══════════════════════════════════════════════════════════════════ */
function DeParaProdutos({ lojaId, loja }: { lojaId: string; loja: LojaIfood }) {
  const { tDynamic } = useI18n();
  const toast = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('produtos')
      .select('id, nome, preco, pdv_code, disponivel, categorias(nome)')
      .eq('loja_id', lojaId)
      .order('nome');
    const lista = (data as any[] ?? []) as Produto[];
    setProdutos(lista);
    setCodigos(Object.fromEntries(lista.map((p) => [p.id, p.pdv_code ?? ''])));
    setCarregando(false);
  }, [lojaId]);

  useEffect(() => { setTimeout(carregar, 0); }, [carregar]);

  const alterados = useMemo(
    () => produtos.filter((p) => (codigos[p.id] ?? '').trim() !== (p.pdv_code ?? '')),
    [produtos, codigos],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (soPendentes && (codigos[p.id] ?? '').trim()) return false;
      if (q && !p.nome.toLowerCase().includes(q) && !(codigos[p.id] ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [produtos, codigos, busca, soPendentes]);

  const mapeados = produtos.filter((p) => (codigos[p.id] ?? '').trim()).length;

  const taxaPct = Number(loja.ifood_taxa_pct || 0);
  const taxaFixa = Number(loja.ifood_taxa_fixa || 0);
  const markupAtivo = taxaPct > 0;
  const precoIfood = (preco: number) =>
    markupAtivo ? preco / (1 - taxaPct / 100) + taxaFixa : preco;

  const salvarTodos = async () => {
    if (alterados.length === 0) return;
    setSalvando(true);
    let falhas = 0;
    for (const p of alterados) {
      const { error } = await supabase
        .from('produtos')
        .update({ pdv_code: (codigos[p.id] ?? '').trim() || null })
        .eq('id', p.id);
      if (error) falhas++;
    }
    setSalvando(false);
    if (falhas > 0) {
      toast(`${falhas} produto(s) falharam ao salvar. Tente novamente.`, 'erro');
    } else {
      toast(`${alterados.length} código(s) salvos com sucesso!`, 'sucesso');
      carregar();
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center pt-16">
        <MiseOnLoader status="Carregando produtos" rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Explicação + estatísticas */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h3 className="font-['Sora'] text-base font-bold text-gray-900 dark:text-white">{tDynamic('Como funciona o De-Para')}</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          O <b>Código iFood</b> de cada produto precisa ser <b>idêntico</b> ao "Código PDV" cadastrado no Portal do Parceiro
          do iFood. Quando um pedido entra via webhook, o MiseOn usa esse código para vincular os itens aos seus produtos —
          garantindo baixa de estoque, ficha técnica e DRE corretos.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-white/5">
            <p className="font-['JetBrains_Mono'] text-xl font-black text-gray-900 dark:text-white">{produtos.length}</p>
            <p className="text-[11px] font-semibold text-gray-500">Produtos</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-900/10">
            <p className="font-['JetBrains_Mono'] text-xl font-black text-emerald-600 dark:text-emerald-400">{mapeados}</p>
            <p className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-400/80">Mapeados</p>
          </div>
          <div className="col-span-2 rounded-xl bg-amber-50 p-3 text-center sm:col-span-1 dark:bg-amber-900/10">
            <p className="font-['JetBrains_Mono'] text-xl font-black text-amber-600 dark:text-amber-400">{produtos.length - mapeados}</p>
            <p className="text-[11px] font-semibold text-amber-600/80 dark:text-amber-400/80">Sem código</p>
          </div>
        </div>
      </div>

      {markupAtivo && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
          <Percent size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-400">
            <b>Markup ativo ({taxaPct}% + {fmt(taxaFixa)}):</b> a coluna "Preço iFood" mostra o preço que deve estar
            no cardápio do iFood para preservar sua margem. Não altere preços manualmente no Portal do iFood.
          </p>
        </div>
      )}

      {/* Busca + ações */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto ou código..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          onClick={() => setSoPendentes((s) => !s)}
          className={`rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
            soPendentes
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-white text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300'
          }`}
        >
          Só pendentes
        </button>
        <button
          onClick={salvarTodos}
          disabled={salvando || alterados.length === 0}
          className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-40"
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Salvar {alterados.length > 0 ? `(${alterados.length})` : ''}
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="hidden grid-cols-[1fr_110px_110px_160px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:grid dark:border-gray-800 dark:bg-white/5">
          <span>Produto</span>
          <span className="text-right">Preço PDV</span>
          <span className="text-right">Preço iFood</span>
          <span>{tDynamic('Código iFood (PDV)')}</span>
        </div>
        {filtrados.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {soPendentes ? 'Nenhum produto pendente de mapeamento. 🎉' : 'Nenhum produto encontrado.'}
          </p>
        )}
        {filtrados.map((p) => {
          const codigo = codigos[p.id] ?? '';
          const alterado = alterados.some((a) => a.id === p.id);
          return (
            <div
              key={p.id}
              className={`grid grid-cols-1 gap-2 border-b border-gray-50 px-4 py-3 last:border-0 sm:grid-cols-[1fr_110px_110px_160px] sm:items-center sm:gap-3 dark:border-white/5 ${
                alterado ? 'bg-red-50/50 dark:bg-red-900/5' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{p.nome}</p>
                <p className="text-[11px] text-gray-400">
                  {(p as any).categorias?.nome ?? 'Sem categoria'}
                  {!p.disponivel && ' · indisponível'}
                </p>
              </div>
              <p className="text-right font-['JetBrains_Mono'] text-xs text-gray-600 dark:text-gray-300">{fmt(Number(p.preco))}</p>
              <p className={`text-right font-['JetBrains_Mono'] text-xs font-bold ${markupAtivo ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                {fmt(precoIfood(Number(p.preco)))}
              </p>
              <input
                value={codigo}
                onChange={(e) => setCodigos((c) => ({ ...c, [p.id]: e.target.value }))}
                placeholder="Ex: 1024"
                className={`w-full rounded-lg border px-2.5 py-2 font-['JetBrains_Mono'] text-xs outline-none transition focus:border-red-500 dark:bg-gray-950 dark:text-gray-100 ${
                  codigo.trim()
                    ? 'border-emerald-300 dark:border-emerald-900/50'
                    : 'border-dashed border-amber-300 dark:border-amber-900/40'
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ABA 3 — Pedidos iFood (últimos 30 dias)
   ══════════════════════════════════════════════════════════════════ */
function PedidosIfood({ lojaId, onIrParaDepara }: { lojaId: string; onIrParaDepara: () => void }) {
  const { tDynamic } = useI18n();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 3600e3).toISOString();
      const { data } = await supabase
        .from('pedidos')
        .select('id, numero, status, identificador_cliente, criado_em, valor_total, valor_bruto_ifood, taxa_ifood_retida, ifood_order_id, itens_pedido(id, nome_produto, produto_id, quantidade, preco_unitario)')
        .eq('loja_id', lojaId)
        .eq('origem', 'ifood')
        .gte('criado_em', cutoff)
        .order('criado_em', { ascending: false })
        .limit(100);
      setPedidos((data as any[]) ?? []);
      setCarregando(false);
    })();
  }, [lojaId]);

  const totais = useMemo(() => {
    const bruto = pedidos.reduce((s, p) => s + Number(p.valor_bruto_ifood ?? p.valor_total ?? 0), 0);
    const taxas = pedidos.reduce((s, p) => s + Number(p.taxa_ifood_retida ?? 0), 0);
    return { bruto, taxas, liquido: bruto - taxas };
  }, [pedidos]);

  if (carregando) {
    return (
      <div className="flex justify-center pt-16">
        <MiseOnLoader status="Buscando pedidos iFood" rows={3} />
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-16 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <Store size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="font-['Sora'] text-sm font-bold text-gray-700 dark:text-gray-200">{tDynamic('Nenhum pedido iFood nos últimos 30 dias')}</p>
        <p className="mt-1 text-xs text-gray-400">
          {tDynamic('Quando um pedido entrar pelo webhook do iFood, ele aparece aqui e no Painel de Pedidos automaticamente.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo financeiro */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="font-['JetBrains_Mono'] text-lg font-black text-gray-900 dark:text-white">{fmt(totais.bruto)}</p>
          <p className="text-[11px] font-semibold text-gray-500">Bruto (30 dias)</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-center dark:border-red-900/30 dark:bg-red-900/10">
          <p className="font-['JetBrains_Mono'] text-lg font-black text-red-600 dark:text-red-400">-{fmt(totais.taxas)}</p>
          <p className="text-[11px] font-semibold text-red-500/80 dark:text-red-400/80">Taxas iFood</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center dark:border-emerald-900/30 dark:bg-emerald-900/10">
          <p className="font-['JetBrains_Mono'] text-lg font-black text-emerald-600 dark:text-emerald-400">{fmt(totais.liquido)}</p>
          <p className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-400/80">{tDynamic('Líquido estimado')}</p>
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="space-y-3">
        {pedidos.map((p) => {
          const bruto = Number(p.valor_bruto_ifood ?? p.valor_total ?? 0);
          const taxa = Number(p.taxa_ifood_retida ?? 0);
          const semMatch = (p.itens_pedido ?? []).filter((i: any) => !i.produto_id);
          return (
            <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg bg-red-600 px-2 py-1 font-['JetBrains_Mono'] text-[10px] font-black text-white">iFood</span>
                  <span className="font-['Sora'] text-sm font-black text-gray-900 dark:text-white">#{p.numero}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(p.criado_em).toLocaleDateString('pt-BR')} {new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/5 dark:text-gray-400">
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
              <p className="mt-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">{p.identificador_cliente}</p>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5">
                  <p className="font-['JetBrains_Mono'] text-xs font-bold text-gray-800 dark:text-gray-100">{fmt(bruto)}</p>
                  <p className="text-[10px] text-gray-400">Bruto</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5">
                  <p className="font-['JetBrains_Mono'] text-xs font-bold text-red-500">-{fmt(taxa)}</p>
                  <p className="text-[10px] text-gray-400">Taxa retida</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5">
                  <p className="font-['JetBrains_Mono'] text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(bruto - taxa)}</p>
                  <p className="text-[10px] text-gray-400">Líquido</p>
                </div>
              </div>

              {semMatch.length > 0 && (
                <button
                  onClick={onIrParaDepara}
                  className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left transition hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-900/10 dark:hover:bg-amber-900/20"
                >
                  <span className="flex items-center gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={14} className="shrink-0" />
                    {semMatch.length} item(ns) sem produto vinculado: {semMatch.slice(0, 2).map((i: any) => i.nome_produto).join(', ')}{semMatch.length > 2 ? '…' : ''}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-black text-amber-700 dark:text-amber-400">
                    Corrigir <ArrowRight size={13} />
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

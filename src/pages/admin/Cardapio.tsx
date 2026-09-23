import { useEffect, useMemo, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, X, Star, EyeOff, Eye, Search, ChevronUp, ChevronDown, Save, Sparkles, ChefHat, Store, Package, Scale,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Categoria, Produto, Insumo, EstacaoPreparo, TipoVenda, KdsEstacao, KdsWorkflow, fmt } from '../../types';
import ImageUpload from '../../components/ImageUpload';
import type { CtxLoja } from './AdminLayout';
import { getOptimizedImageUrl } from '../../lib/cdn';
import { useI18n } from '../../contexts/I18nContext';
import { HorizontalScrollContainer } from '../../components/ui';
import NutricaoDoPrato from '../../components/admin/NutricaoDoPrato';
import { CONFIG_NUTRICAO_PADRAO, type ConfigNutricaoPrato } from '../../lib/nutricao';
import PainelNutricaoCardapio, { type CoberturaProduto } from '../../components/admin/PainelNutricaoCardapio';
import SeletorInsumo from '../../components/producao/SeletorInsumo';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { ModalOpcoes } from '../../components/pdv/ModalOpcoes';
import { equivalenteFisico } from '../../lib/unidades';

/** Input de dinheiro com prefixo "R$" fixo e máscara de centavos (vírgula). */
function CampoPreco({ value, onChange, placeholder, className = '', autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1 rounded-xl border pl-2.5 dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      <span className="shrink-0 text-xs font-bold text-gray-400">R$</span>
      <CurrencyInput value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus}
        className="min-w-0 flex-1 bg-transparent py-2.5 pr-2.5 text-sm outline-none dark:text-gray-100" />
    </div>
  );
}

type Tab = 'produtos' | 'categorias';

export default function CardapioAdmin() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const [tab, setTab] = useState<Tab>('produtos');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [busca, setBusca] = useState('');
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null);
  const [rateioFixo, setRateioFixo] = useState(0);
  const [lojaInfo, setLojaInfo] = useState<any>(null);
  const [cobertura, setCobertura] = useState<CoberturaProduto[]>([]);

  const carregar = useCallback(async () => {
    const [{ data: c }, { data: p }, { data: i }, { data: est }, { data: config }, { data: loja }, { data: cob }] = await Promise.all([
      supabase.from('categorias').select('*').eq('loja_id', lojaId).order('ordem'),
      supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*)), fichas_tecnicas(*)').eq('loja_id', lojaId).order('ordem'),
      supabase.from('insumos').select('*').eq('loja_id', lojaId).eq('ativo', true).order('nome'),
      supabase.rpc('fn_produtos_com_estoque', { p_loja_id: lojaId }),
      supabase.from('configuracoes_custo').select('*').eq('loja_id', lojaId).maybeSingle(),
      // A coluna é `plano`; `plano_tipo` nunca existiu e derrubava este SELECT
      // inteiro (a tela ficava sem as taxas do iFood). Alias mantém o resto do
      // código intacto.
      supabase.from('lojas').select('plano_tipo:plano, ifood_addon_ativo, ifood_taxa_pct, ifood_taxa_fixa').eq('id', lojaId).single(),
      // Semáforo de nutrição por prato: o que publica, o que falta e por quê.
      supabase.from('vw_nutricao_cobertura').select('*').eq('loja_id', lojaId).order('produto'),
    ]);
    const mapaEstoque = new Map<string, boolean>((est ?? []).map((e: any) => [e.produto_id, e.tem_estoque]));
    
    if (config) {
      const totalFixo = Number(config.custo_aluguel) + Number(config.custo_energia) + Number(config.custo_agua) + Number(config.custo_internet) + Number(config.custo_gas) + Number(config.outros_custos_fixos);
      const vendasMes = Number(config.expectativa_vendas_mes) || 1;
      setRateioFixo(totalFixo / vendasMes);
    }
    setCategorias((c as Categoria[]) ?? []);
    setProdutos(((p as Produto[]) ?? []).map((prod) => ({ ...prod, tem_estoque: mapaEstoque.get(prod.id) ?? true })));
    setInsumos((i as Insumo[]) ?? []);
    setLojaInfo(loja);
    setCobertura((cob as CoberturaProduto[]) ?? []);
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = useMemo(
    () => produtos.filter((p) =>
      (!catAtiva || p.categoria_id === catAtiva) &&
      (!busca || p.nome.toLowerCase().includes(busca.toLowerCase()))),
    [produtos, catAtiva, busca],
  );

  const nomeCategoria = (id?: string) => categorias.find((c) => c.id === id)?.nome ?? tDynamic('Sem categoria');

  const toggleDisponivel = async (p: Produto) => {
    await supabase.from('produtos').update({ disponivel: !p.disponivel }).eq('id', p.id);
    carregar();
  };
  const toggleDestaque = async (p: Produto) => {
    await supabase.from('produtos').update({ destaque: !p.destaque }).eq('id', p.id);
    carregar();
  };
  const excluirProduto = async (p: Produto) => {
    if (!confirm(`Excluir "${p.nome}"? Essa ação não pode ser desfeita.`)) return;
    await supabase.from('produtos').delete().eq('id', p.id);
    carregar();
  };

  // Ação em massa: marcar toda a categoria como revenda direta (não entra no
  // KDS, balcão entrega sem passar pela cozinha) ou como preparo (padrão).
  const marcarCategoriaEstacao = async (categoriaId: string | null, estacao: EstacaoPreparo) => {
    const alvo = categoriaId ? produtos.filter((p) => p.categoria_id === categoriaId) : visiveis;
    if (!alvo.length) return;
    const rotulo = estacao === 'DIRETO' ? 'revenda direta (não vai para a cozinha)' : 'preparo na cozinha';
    if (!confirm(`Marcar ${alvo.length} produto(s) desta categoria como "${rotulo}"?`)) return;
    await supabase.from('produtos').update({ estacao_preparo: estacao }).in('id', alvo.map((p) => p.id));
    carregar();
  };

  return (
    <div data-tour="tour-cardapio-header" className="p-4 pb-28 lg:pb-12">
      <div className="mb-3 flex gap-2">
        {(['produtos', 'categorias'] as Tab[]).map((t) => (
          <button type="button" key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm dark:bg-gray-900 dark:text-gray-300 dark:border dark:border-gray-800'}`}>
            {t === 'produtos' ? tDynamic('Produtos') : tDynamic('Categorias')}
          </button>
        ))}
      </div>

      {tab === 'categorias' && (
        <CategoriasTab lojaId={lojaId} categorias={categorias} onChange={carregar} />
      )}

      {tab === 'produtos' && (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 px-3 py-2 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800">
            <Search size={16} className="text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tDynamic('Buscar produto…')}
              className="w-full bg-transparent text-sm outline-none" />
          </div>

          <HorizontalScrollContainer className="mb-3 pb-1">
            <button type="button" onClick={() => setCatAtiva(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${!catAtiva ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm dark:bg-gray-900 dark:text-gray-300 dark:border dark:border-gray-800'}`}>
              {tDynamic('Tudo')}
            </button>
            {categorias.map((c) => (
              <button type="button" key={c.id} onClick={() => setCatAtiva(c.id === catAtiva ? null : c.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${catAtiva === c.id ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm dark:bg-gray-900 dark:text-gray-300 dark:border dark:border-gray-800'}`}>
                {c.nome}
              </button>
            ))}
          </HorizontalScrollContainer>

          <button type="button" onClick={() => setEditando('novo')}
            className="mb-3 flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--cor-primaria)] py-2.5 text-sm font-semibold text-white">
            <Plus size={15} /> {tDynamic('Novo produto')}
          </button>

          {catAtiva && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-900/40">
              <span className="font-semibold text-gray-500 dark:text-gray-400">Marcar categoria toda:</span>
              <button type="button" onClick={() => marcarCategoriaEstacao(catAtiva, 'DIRETO')}
                className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Store size={12} /> Revenda direta
              </button>
              <button type="button" onClick={() => marcarCategoriaEstacao(catAtiva, 'COZINHA')}
                className="flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 font-bold text-orange-700 hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-400">
                <ChefHat size={12} /> {tDynamic('Preparo na cozinha')}
              </button>
            </div>
          )}

          <PainelNutricaoCardapio cobertura={cobertura} />

          <div className="space-y-2">
            {visiveis.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800 ${!p.disponivel ? 'opacity-50' : ''}`}>
                {p.imagem_url
                  ? <img src={getOptimizedImageUrl(p.imagem_url)} className="h-14 w-14 shrink-0 rounded-lg object-cover" alt="" />
                  : <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-100" />}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium dark:text-gray-100">
                    {p.nome}
                    {p.tem_estoque === false && (
                      <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-xs opacity-80 font-bold text-red-600">SEM INSUMO</span>
                    )}
                    {p.estacao_preparo === 'DIRETO' && (
                      <span title="Revenda direta — não entra na fila da cozinha" className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs opacity-80 font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Store size={9} /> REVENDA
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{nomeCategoria(p.categoria_id)}</p>
                  <p className="text-sm font-bold text-[var(--cor-primaria)]">
                    {p.tipo_venda === 'POR_PESO' ? `${fmt(Number(p.preco_por_quilo || 0))}/kg` : fmt(Number(p.preco))}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <button type="button" onClick={() => toggleDestaque(p)} title="Destaque">
                    <Star size={16} className={p.destaque ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                  </button>
                  <button type="button" onClick={() => toggleDisponivel(p)} title="Disponibilidade">
                    {p.disponivel ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
                  </button>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button type="button" onClick={() => setEditando(p)} className="rounded-lg border p-1.5 text-gray-500 dark:text-gray-400"><Pencil size={14} /></button>
                  <button type="button" onClick={() => excluirProduto(p)} className="rounded-lg border border-red-200 p-1.5 text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {visiveis.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum produto encontrado.</p>}
          </div>
        </>
      )}

      {editando && (
        <ProdutoModal
          lojaId={lojaId}
          produto={editando === 'novo' ? null : editando}
          categorias={categorias}
          insumos={insumos}
          rateioFixo={rateioFixo}
          lojaInfo={lojaInfo}
          onClose={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}

// ── Categorias ────────────────────────────────────────────────
function CategoriasTab({ lojaId, categorias, onChange }: { lojaId: string; categorias: Categoria[]; onChange: () => void }) {
  const [nova, setNova] = useState('');

  const criar = async () => {
    if (!nova.trim()) return;
    const ordem = categorias.length ? Math.max(...categorias.map((c) => c.ordem)) + 1 : 0;
    await supabase.from('categorias').insert({ loja_id: lojaId, nome: nova.trim(), ordem });
    setNova('');
    onChange();
  };
  const renomear = async (c: Categoria, nome: string) => {
    if (!nome.trim() || nome === c.nome) return;
    await supabase.from('categorias').update({ nome: nome.trim() }).eq('id', c.id);
    onChange();
  };
  const mover = async (c: Categoria, dir: -1 | 1) => {
    const idx = categorias.findIndex((x) => x.id === c.id);
    const alvo = categorias[idx + dir];
    if (!alvo) return;
    await Promise.all([
      supabase.from('categorias').update({ ordem: alvo.ordem }).eq('id', c.id),
      supabase.from('categorias').update({ ordem: c.ordem }).eq('id', alvo.id),
    ]);
    onChange();
  };
  const toggleAtiva = async (c: Categoria) => {
    await supabase.from('categorias').update({ ativo: !c.ativo }).eq('id', c.id);
    onChange();
  };
  const excluir = async (c: Categoria) => {
    if (!confirm(`Excluir a categoria "${c.nome}"? Produtos ficam sem categoria.`)) return;
    await supabase.from('categorias').delete().eq('id', c.id);
    onChange();
  };

  return (
    <div className="space-y-2">
      {categorias.map((c, idx) => (
        <div key={c.id} className={`flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-2.5 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800 ${c.ativo === false ? 'opacity-50' : ''}`}>
          <div className="flex flex-col">
            <button type="button" disabled={idx === 0} onClick={() => mover(c, -1)} className="text-gray-400 disabled:opacity-20"><ChevronUp size={14} /></button>
            <button type="button" disabled={idx === categorias.length - 1} onClick={() => mover(c, 1)} className="text-gray-400 disabled:opacity-20"><ChevronDown size={14} /></button>
          </div>
          <input defaultValue={c.nome} onBlur={(e) => renomear(c, e.target.value)}
            className="flex-1 rounded-lg border-none bg-transparent p-1 text-sm font-medium outline-none focus:bg-gray-50 dark:text-gray-100 dark:focus:bg-gray-800" />
          <button type="button" onClick={() => toggleAtiva(c)} className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {c.ativo === false ? 'Inativa' : 'Ativa'}
          </button>
          <button type="button" onClick={() => excluir(c)} className="rounded-lg border border-red-200 p-1.5 text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}

      <div className="flex gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-2.5 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800">
        <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova categoria (ex: Bebidas)"
          className="flex-1 rounded-lg border p-2 text-sm dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" onKeyDown={(e) => e.key === 'Enter' && criar()} />
        <button type="button" onClick={criar} className="rounded-lg bg-[var(--cor-primaria)] px-4 text-sm font-semibold text-white">Add</button>
      </div>
    </div>
  );
}

// ── Modal de produto (dados + adicionais + ficha técnica) ──────
interface OpcaoForm { _key: string; nome: string; preco_adicional: number; disponivel: boolean; insumo_id?: string | null; quantidade_insumo?: number | null; }
interface GrupoForm { _key: string; nome: string; min_escolhas: number; max_escolhas: number; opcoes: OpcaoForm[]; }
interface FichaForm { insumo_id: string; quantidade_consumida: string; }

function ProdutoModal({ lojaId, produto, categorias, insumos, rateioFixo, lojaInfo, onClose, onSalvo }: {
  lojaId: string;
  produto: Produto | null;
  categorias: Categoria[];
  insumos: Insumo[];
  rateioFixo: number;
  lojaInfo: any;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const { tDynamic } = useI18n();
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [tipoVenda, setTipoVenda] = useState<TipoVenda>(produto?.tipo_venda ?? 'UNITARIO');
  const [preco, setPreco] = useState(String(produto?.preco ?? ''));
  const [precoOriginal, setPrecoOriginal] = useState(
    produto?.preco_original != null ? String(produto.preco_original) : '',
  );
  const [precoPorQuilo, setPrecoPorQuilo] = useState(String(produto?.preco_por_quilo ?? ''));
  const [galeria, setGaleria] = useState<string[]>(produto?.galeria ?? (produto?.imagem_url ? [produto.imagem_url] : []));
  const [categoriaId, setCategoriaId] = useState(produto?.categoria_id ?? categorias[0]?.id ?? '');
  const [isCombo, setIsCombo] = useState(produto?.is_combo ?? false);
  const [destaque, setDestaque] = useState(produto?.destaque ?? false);
  const [controlaEstoque, setControlaEstoque] = useState(produto?.controla_estoque ?? true);
  const [pdvCode, setPdvCode] = useState(produto?.pdv_code ?? '');
  const [estacaoPreparo, setEstacaoPreparo] = useState<EstacaoPreparo>(produto?.estacao_preparo ?? 'COZINHA');
  const [estacaoKdsId, setEstacaoKdsId] = useState<string>(produto?.estacao_kds_id ?? '');
  const [estacoesKds, setEstacoesKds] = useState<KdsEstacao[]>([]);
  const [workflowsKds, setWorkflowsKds] = useState<KdsWorkflow[]>([]);
  const [perfilPreparo, setPerfilPreparo] = useState<'ALIMENTO' | 'DRINK' | 'BEBIDA_PRONTA'>(produto?.perfil_preparo ?? 'ALIMENTO');
  const [teorAlcoolico, setTeorAlcoolico] = useState(produto?.teor_alcoolico_pct != null ? String(produto.teor_alcoolico_pct) : '');
  const [volumePorcaoMl, setVolumePorcaoMl] = useState(produto?.volume_porcao_ml != null ? String(produto.volume_porcao_ml) : '');

  useEffect(() => {
    supabase.from('kds_estacoes').select('*').eq('loja_id', lojaId).eq('ativo', true).order('ordem')
      .then(({ data }) => setEstacoesKds((data as KdsEstacao[]) ?? []));
    supabase.from('kds_workflows').select('*').eq('loja_id', lojaId)
      .then(({ data }) => setWorkflowsKds((data as KdsWorkflow[]) ?? []));
  }, [lojaId]);
  const [grupos, setGrupos] = useState<GrupoForm[]>(
    (produto?.grupos_opcoes ?? []).map((g) => ({
      ...g, _key: g.id,
      opcoes: g.opcoes.map((o) => ({ ...o, _key: o.id })),
    })),
  );
  const [ficha, setFicha] = useState<FichaForm[]>(
    (produto?.fichas_tecnicas ?? []).map((f) => ({ insumo_id: f.insumo_id, quantidade_consumida: String(f.quantidade_consumida) })),
  );
  const [salvando, setSalvando] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [sugerindoFicha, setSugerindoFicha] = useState(false);
  const [avisoFichaIA, setAvisoFichaIA] = useState('');
  const [sugerindoExtras, setSugerindoExtras] = useState(false);
  const [avisoExtrasIA, setAvisoExtrasIA] = useState('');
  // Como o prato é servido (porções, cocção, revenda) — produtos_nutricao_config.
  const [nutriConfig, setNutriConfig] = useState<ConfigNutricaoPrato>(CONFIG_NUTRICAO_PADRAO);

  useEffect(() => {
    if (!produto?.id) { setNutriConfig(CONFIG_NUTRICAO_PADRAO); return; }
    let vivo = true;
    supabase.from('produtos_nutricao_config').select('*').eq('produto_id', produto.id).maybeSingle()
      .then(({ data }) => {
        if (!vivo || !data) return;
        setNutriConfig({
          exibir: data.exibir, porcoes: Number(data.porcoes ?? 1),
          peso_porcao_g: data.peso_porcao_g != null ? Number(data.peso_porcao_g) : null,
          fator_coccao: Number(data.fator_coccao ?? 1), metodo_coccao: data.metodo_coccao ?? null,
          insumo_id: data.insumo_id ?? null,
          quantidade_insumo: data.quantidade_insumo != null ? Number(data.quantidade_insumo) : null,
        });
      });
    return () => { vivo = false; };
  }, [produto?.id]);

  const gerarDescricaoIA = async () => {
    if (!nome.trim()) return setErro('Preencha o nome do produto primeiro para a IA saber o que gerar.');
    setGerandoIA(true);
    setErro('');
    try {
      const catNome = categorias.find(c => c.id === categoriaId)?.nome;

      const { data, error } = await supabase.functions.invoke('ai-gerar-descricao', {
        body: { nome_produto: nome, nome_categoria: catNome }
      });

      if (error) {
        let msg = error.message;
        try {
          if ('context' in error && (error as any).context) {
            const body = await (error as any).context.json();
            if (body?.error) msg = body.error;
          }
        } catch {
          /* ignora falhas ao ler json do contexto do erro */
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      
      const texto = data?.texto;
      if (texto) setDescricao(texto);
      else throw new Error('Não foi possível gerar a descrição.');
    } catch (e: any) {
      setErro('Erro na IA: ' + (e?.message || 'Falha ao conectar com o serviço de IA.'));
    }
    setGerandoIA(false);
  };

  const custoInsumos = ficha.reduce((s, f) => {
    const i = insumos.find((x) => x.id === f.insumo_id);
    if (!i || !f.quantidade_consumida) return s;
    const custoUnit = Number(i.qtd_embalagem) > 0 ? Number(i.preco_embalagem) / Number(i.qtd_embalagem) : 0;
    return s + custoUnit * Number(f.quantidade_consumida);
  }, 0);
  const precoNum = Number(preco || 0);
  const lucroLiquidoReal = precoNum - custoInsumos - rateioFixo;
  const margemReal = precoNum > 0 ? (lucroLiquidoReal / precoNum) * 100 : 0;

  const markupIfood = lojaInfo?.ifood_addon_ativo && lojaInfo?.ifood_taxa_pct 
    ? (precoNum / (1 - (Number(lojaInfo.ifood_taxa_pct) / 100))) + Number(lojaInfo.ifood_taxa_fixa || 0)
    : precoNum;
  const isIfoodActive = lojaInfo?.ifood_addon_ativo && lojaInfo?.ifood_taxa_pct > 0;

  const addGrupo = () => setGrupos((g) => [...g, { _key: crypto.randomUUID(), nome: '', min_escolhas: 0, max_escolhas: 1, opcoes: [] }]);
  const addGrupoPontoCarne = () => {
    const existente = grupos.some((g) => g.nome.trim().toLocaleLowerCase('pt-BR') === 'ponto da carne');
    if (existente) return setErro('O grupo Ponto da carne já existe neste produto.');
    setGrupos((atuais) => [...atuais, {
      _key: crypto.randomUUID(),
      nome: 'Ponto da carne',
      min_escolhas: 1,
      max_escolhas: 1,
      opcoes: ['Mal passado', 'Ao ponto', 'Bem passado'].map((nomeOpcao) => ({
        _key: crypto.randomUUID(),
        nome: nomeOpcao,
        preco_adicional: 0,
        disponivel: true,
      })),
    }]);
    setErro('');
  };
  const addOpcao = (gKey: string) => setGrupos((g) => g.map((x) => x._key === gKey
    ? { ...x, opcoes: [...x.opcoes, { _key: crypto.randomUUID(), nome: '', preco_adicional: 0, disponivel: true }] }
    : x));
  const addInsumoFicha = () => insumos[0] && setFicha((f) => [...f, { insumo_id: insumos[0].id, quantidade_consumida: '' }]);

  // IA sugere, nunca decide: só some insumos já cadastrados na loja, nunca
  // sobrescreve o que já está na ficha (só acrescenta o que ainda não tem).
  const sugerirFichaIA = async () => {
    if (!nome.trim()) return setErro('Preencha o nome do produto primeiro para a IA saber o que sugerir.');
    if (!insumos.length) return setErro('Cadastre insumos em Estoque antes de pedir sugestão de ficha técnica.');
    setSugerindoFicha(true);
    setAvisoFichaIA('');
    setErro('');
    try {
      const nomeCat = categorias.find((c) => c.id === categoriaId)?.nome;
      const { data, error } = await supabase.functions.invoke('ai-sugerir-ficha', {
        body: {
          tipo: 'ficha_tecnica',
          nome_produto: nome,
          nome_categoria: nomeCat,
          descricao,
          insumos: insumos.map((i) => ({ id: i.id, nome: i.nome, unidade_medida: i.unidade_medida })),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const sugestao = data?.sugestao ?? {};
      const itens: { insumo_id: string; quantidade: number }[] = Array.isArray(sugestao.itens) ? sugestao.itens : [];
      const faltando: string[] = Array.isArray(sugestao.insumos_faltando) ? sugestao.insumos_faltando : [];

      const idsValidos = new Set(insumos.map((i) => i.id));
      const jaNaFicha = new Set(ficha.map((f) => f.insumo_id));
      const novos = itens
        .filter((it) => idsValidos.has(it.insumo_id) && !jaNaFicha.has(it.insumo_id) && Number(it.quantidade) > 0)
        .map((it) => ({ insumo_id: it.insumo_id, quantidade_consumida: String(it.quantidade) }));

      if (!novos.length && !faltando.length) {
        setAvisoFichaIA('A IA não encontrou nenhum insumo cadastrado que combine com este produto.');
      } else {
        if (novos.length) setFicha((f) => [...f, ...novos]);
        const partes: string[] = [];
        if (novos.length) partes.push(`${novos.length} insumo(s) adicionado(s) — revise as quantidades antes de salvar.`);
        if (faltando.length) partes.push(`A IA também sugere: ${faltando.join(', ')} — cadastre em Estoque para incluir.`);
        setAvisoFichaIA(partes.join(' '));
      }
    } catch (e: any) {
      setErro('Erro na IA: ' + (e?.message || 'Falha ao conectar com o serviço de IA.'));
    }
    setSugerindoFicha(false);
  };

  // Mesma regra: acrescenta grupos novos, nunca troca ou apaga o que o
  // lojista já configurou (nem grupos com o mesmo nome de um já existente).
  const sugerirExtrasIA = async () => {
    if (!nome.trim()) return setErro('Preencha o nome do produto primeiro para a IA saber o que sugerir.');
    setSugerindoExtras(true);
    setAvisoExtrasIA('');
    setErro('');
    try {
      const nomeCat = categorias.find((c) => c.id === categoriaId)?.nome;
      const { data, error } = await supabase.functions.invoke('ai-sugerir-ficha', {
        body: { tipo: 'extras', nome_produto: nome, nome_categoria: nomeCat, descricao },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const sugestao = data?.sugestao ?? {};
      const gruposSugeridos: any[] = Array.isArray(sugestao.grupos) ? sugestao.grupos : [];
      const nomesAtuais = new Set(grupos.map((g) => g.nome.trim().toLocaleLowerCase('pt-BR')));

      const novos = gruposSugeridos
        .filter((g) => g?.nome && Array.isArray(g.opcoes) && g.opcoes.some((o: any) => o?.nome)
          && !nomesAtuais.has(String(g.nome).trim().toLocaleLowerCase('pt-BR')))
        .map((g) => {
          const opcoesValidas = g.opcoes.filter((o: any) => o?.nome);
          return {
            _key: crypto.randomUUID(),
            nome: String(g.nome).trim(),
            min_escolhas: Math.max(0, Number(g.min_escolhas) || 0),
            max_escolhas: Math.min(Math.max(1, Number(g.max_escolhas) || 1), opcoesValidas.length),
            opcoes: opcoesValidas.map((o: any) => ({
              _key: crypto.randomUUID(),
              nome: String(o.nome).trim(),
              preco_adicional: Number(o.preco_adicional) || 0,
              disponivel: true,
            })),
          };
        });

      if (!novos.length) {
        setAvisoExtrasIA('A IA não sugeriu nenhum grupo novo (ou já existem grupos com esses nomes neste produto).');
      } else {
        setGrupos((atuais) => [...atuais, ...novos]);
        setAvisoExtrasIA(`${novos.length} grupo(s) sugerido(s) — revise nomes, valores e vínculo de estoque antes de salvar.`);
      }
    } catch (e: any) {
      setErro('Erro na IA: ' + (e?.message || 'Falha ao conectar com o serviço de IA.'));
    }
    setSugerindoExtras(false);
  };

  const salvar = async () => {
    setErro('');
    if (!nome.trim() || !preco) return setErro('Preencha nome e preço.');
    for (const grupo of grupos.filter((g) => g.nome.trim())) {
      const opcoesValidas = grupo.opcoes.filter((o) => o.nome.trim());
      if (grupo.min_escolhas < 0 || grupo.max_escolhas < 1 || grupo.min_escolhas > grupo.max_escolhas) {
        return setErro(`Revise os limites do grupo "${grupo.nome}".`);
      }
      if (opcoesValidas.length < grupo.min_escolhas || opcoesValidas.length < grupo.max_escolhas) {
        return setErro(`O grupo "${grupo.nome}" precisa ter opções suficientes para os limites configurados.`);
      }
      const nomes = opcoesValidas.map((o) => o.nome.trim().toLocaleLowerCase('pt-BR'));
      if (new Set(nomes).size !== nomes.length) return setErro(`O grupo "${grupo.nome}" tem opções repetidas.`);
    }
    setSalvando(true);
    try {
      const payload = {
        loja_id: lojaId,
        nome: nome.trim(),
        descricao: descricao || null,
        preco: precoNum,
        imagem_url: galeria[0] || null,
        galeria,
        categoria_id: categoriaId || null,
        is_combo: isCombo,
        destaque,
        controla_estoque: controlaEstoque,
        tipo_venda: tipoVenda,
        preco_por_quilo: tipoVenda === 'POR_PESO' ? Number(precoPorQuilo || 0) : 0,
        estacao_preparo: estacaoPreparo,
        // Vazio = sem promoção (NULL); o CHECK do banco recusa zero/negativo.
        preco_original: precoOriginal.trim() === '' ? null : Number(precoOriginal),
        pdv_code: pdvCode.trim() || null,
        estacao_kds_id: estacaoKdsId || null,
        workflow_kds_id: estacaoKdsId ? (workflowsKds.find((w) => w.estacao_id === estacaoKdsId)?.id ?? null) : null,
        perfil_preparo: perfilPreparo,
        teor_alcoolico_pct: perfilPreparo === 'DRINK' && teorAlcoolico ? Number(teorAlcoolico) : null,
        volume_porcao_ml: perfilPreparo === 'DRINK' && volumePorcaoMl ? Number(volumePorcaoMl) : null,
      };

      let produtoId = produto?.id;
      if (produtoId) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', produtoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('produtos').insert(payload).select('id').single();
        if (error) throw error;
        produtoId = data.id;
      }

      // adicionais: substitui tudo (delete cascade em opcoes) — simples e seguro pro volume desse CRUD
      await supabase.from('grupos_opcoes').delete().eq('produto_id', produtoId);
      for (const g of grupos) {
        if (!g.nome.trim()) continue;
        const { data: novoGrupo, error: eg } = await supabase.from('grupos_opcoes')
          .insert({ produto_id: produtoId, nome: g.nome.trim(), min_escolhas: g.min_escolhas, max_escolhas: g.max_escolhas })
          .select('id').single();
        if (eg) throw eg;
        const opcoesValidas = g.opcoes.filter((o) => o.nome.trim());
        if (opcoesValidas.length) {
          const { error: eo } = await supabase.from('opcoes').insert(opcoesValidas.map((o) => ({
            grupo_id: novoGrupo.id,
            nome: o.nome.trim(),
            preco_adicional: Number(o.preco_adicional || 0),
            disponivel: o.disponivel,
            insumo_id: o.insumo_id || null,
            quantidade_insumo: o.insumo_id ? Number(o.quantidade_insumo || 1) : null,
          })));
          if (eo) throw eo;
        }
      }

      // ficha técnica: substitui tudo
      await supabase.from('fichas_tecnicas').delete().eq('produto_id', produtoId);
      const fichaValida = ficha.filter((f) => f.insumo_id && Number(f.quantidade_consumida) > 0);
      if (fichaValida.length) {
        const { error: ef } = await supabase.from('fichas_tecnicas').insert(fichaValida.map((f) => ({
          produto_id: produtoId, insumo_id: f.insumo_id, quantidade_consumida: Number(f.quantidade_consumida),
        })));
        if (ef) throw ef;
      }

      // Como o prato é servido. O upsert dispara o recálculo do cache por
      // trigger — não existe "salvar e esquecer de atualizar a vitrine".
      const { error: en } = await supabase.from('produtos_nutricao_config').upsert({
        produto_id: produtoId,
        loja_id: lojaId,
        exibir: nutriConfig.exibir,
        porcoes: nutriConfig.porcoes,
        peso_porcao_g: nutriConfig.peso_porcao_g,
        fator_coccao: nutriConfig.fator_coccao,
        metodo_coccao: nutriConfig.metodo_coccao,
        insumo_id: nutriConfig.insumo_id,
        quantidade_insumo: nutriConfig.insumo_id ? (nutriConfig.quantidade_insumo ?? 1) : null,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'produto_id' });
      if (en) throw en;

      onSalvo();
    } catch (e: any) {
      setErro('Erro ao salvar: ' + (e?.message ?? String(e)));
    }
    setSalvando(false);
  };

  // Monta um Produto temporário a partir do formulário — nada gravado — só
  // para alimentar o MESMO componente que o cliente usa no cardápio real.
  // WYSIWYG de verdade: se mudar o ModalOpcoes do cliente, o preview muda junto.
  const produtoPreview: Produto = useMemo(() => ({
    id: produto?.id ?? 'preview',
    nome: nome.trim() || tDynamic('Novo produto'),
    descricao: descricao || undefined,
    preco: precoNum,
    preco_original: precoOriginal.trim() ? Number(precoOriginal) : undefined,
    imagem_url: galeria[0],
    galeria,
    is_combo: isCombo,
    destaque,
    disponivel: true,
    controla_estoque: controlaEstoque,
    vendidos: 0,
    tipo_venda: tipoVenda,
    preco_por_quilo: tipoVenda === 'POR_PESO' ? Number(precoPorQuilo || 0) : undefined,
    grupos_opcoes: grupos.filter((g) => g.nome.trim()).map((g) => ({
      id: g._key,
      produto_id: produto?.id ?? 'preview',
      nome: g.nome.trim(),
      min_escolhas: g.min_escolhas,
      max_escolhas: g.max_escolhas,
      opcoes: g.opcoes.filter((o) => o.nome.trim()).map((o) => ({
        id: o._key,
        grupo_id: g._key,
        nome: o.nome.trim(),
        preco_adicional: Number(o.preco_adicional) || 0,
        disponivel: o.disponivel,
        insumo_id: o.insumo_id,
        quantidade_insumo: o.quantidade_insumo,
      })),
    })),
  }), [produto?.id, nome, descricao, precoNum, precoOriginal, galeria, isCombo, destaque, controlaEstoque, tipoVenda, precoPorQuilo, grupos, tDynamic]);

  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="sheet max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold dark:text-gray-100">{produto ? 'Editar produto' : 'Novo produto'}</h3>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMostrarPreview(true)} disabled={!nome.trim() || !preco}
              title={tDynamic('Abrir exatamente como o cliente vê este produto no cardápio')}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              <Eye size={14} /> {tDynamic('Ver como o cliente vê')}
            </button>
            <button type="button" onClick={onClose} className="dark:text-gray-300"><X size={20} /></button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto" className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <div className="relative">
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição" rows={3} className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 pb-10" />
            <button type="button" onClick={gerarDescricaoIA} disabled={gerandoIA || !nome} className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-200 disabled:opacity-50 dark:bg-orange-900/30 dark:text-orange-400">
              <Sparkles size={14} className={gerandoIA ? "animate-pulse" : ""} /> {gerandoIA ? 'Gerando Mágica...' : 'Gerar com IA'}
            </button>
          </div>
          {/* Modelo de Venda: Unidade ou Peso */}
          <div className="rounded-2xl border p-3 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{tDynamic('Modelo de Venda')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipoVenda('UNITARIO')}
                className={`rounded-xl border p-2.5 text-xs font-bold transition-all ${
                  tipoVenda === 'UNITARIO'
                    ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]'
                    : 'border-gray-200 text-gray-400 dark:border-gray-700'
                }`}>
                <span className="flex items-center justify-center gap-2"><Package size={15} aria-hidden="true" /> Por Unidade (Inteira)</span>
              </button>
              <button type="button" onClick={() => setTipoVenda('POR_PESO')}
                className={`rounded-xl border p-2.5 text-xs font-bold transition-all ${
                  tipoVenda === 'POR_PESO'
                    ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]'
                    : 'border-gray-200 text-gray-400 dark:border-gray-700'
                }`}>
                <span className="flex items-center justify-center gap-2"><Scale size={15} aria-hidden="true" /> Por Quilo (Self-Service)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {tipoVenda === 'POR_PESO' ? (
              <label className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                {tDynamic('Preço por Kg')}
                <CampoPreco
                  value={precoPorQuilo}
                  onChange={(v) => { setPrecoPorQuilo(v); setPreco(v); }}
                  placeholder="0,00 /kg"
                  className="mt-0.5 border-emerald-400 bg-emerald-50/30 font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                />
              </label>
            ) : (
              <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {tDynamic('Preço de venda')}
                <CampoPreco value={preco} onChange={setPreco} placeholder="0,00" className="mt-0.5" />
              </label>
            )}
            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {tDynamic('Categoria')}
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="mt-0.5 w-full rounded-xl border p-2.5 text-sm font-normal normal-case dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="">Sem categoria</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          </div>
          {/* Promoção "De/Por": o preço riscado da vitrine. Até 20260908 os
              únicos valores possíveis estavam fixados por nome no bundle do
              cardápio público — agora é campo da loja. */}
          <div className="pt-1">
            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {tDynamic('Preço "De:" (opcional — mostra risco de promoção)')}
              <CampoPreco value={precoOriginal} onChange={setPrecoOriginal} placeholder="0,00" className="mt-0.5" />
            </label>
            {precoOriginal !== '' && Number(precoOriginal) <= Number(preco || 0) && (
              <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                {tDynamic('O preço "De" precisa ser maior que o preço de venda para a vitrine riscar.')}
              </p>
            )}
          </div>
          <div className="pt-1">
            <input value={pdvCode} onChange={(e) => setPdvCode(e.target.value)} placeholder="Código PDV / iFood (opcional)" className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            <p className="mt-1 text-xs opacity-90 text-gray-400">{tDynamic('Use este código para mapear este produto com integrações externas como o iFood.')}</p>
            {isIfoodActive && pdvCode && (
              <div className="mt-2 rounded-xl bg-amber-50 p-3 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30">
                <p className="text-xs opacity-90 font-bold text-amber-800 dark:text-amber-500">
                  Bloqueio iFood Ativo
                </p>
                <p className="text-xs opacity-90 text-amber-700 dark:text-amber-400 mt-1">
                  {tDynamic('O markup está ligado.')} <b>{tDynamic('Não altere o preço deste item manualmente no Portal do iFood')}</b>, pois o MiseOn será a fonte oficial do preço, sob pena de dessincronização financeira.
                </p>
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{tDynamic('Fotos do Produto (até 3)')}</p>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                (galeria[i] || i === galeria.length) ? (
                  <ImageUpload 
                    key={i}
                    lojaId={lojaId} 
                    pasta="produtos" 
                    value={galeria[i]} 
                    onChange={(url) => {
                      setGaleria(prev => {
                        const copy = [...prev];
                        if (url) copy[i] = url;
                        else copy.splice(i, 1);
                        return copy.filter(Boolean);
                      });
                    }}
                    aspecto="aspect-square" 
                  />
                ) : <div key={i} className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50 aspect-square" />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1 text-xs dark:text-gray-300">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={isCombo} onChange={(e) => setIsCombo(e.target.checked)} /> Combo</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} /> Destaque</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={controlaEstoque} onChange={(e) => setControlaEstoque(e.target.checked)} /> Controla estoque</label>
          </div>

          {/* Estação de preparo: define se o item entra na fila do KDS. */}
          <div className="rounded-2xl border p-3 dark:border-gray-800">
            <p className="mb-2 text-sm font-semibold dark:text-gray-200">{tDynamic('Onde este produto é preparado?')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEstacaoPreparo('COZINHA')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                  estacaoPreparo === 'COZINHA'
                    ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-400'
                    : 'border-gray-200 text-gray-400 dark:border-gray-700'
                }`}>
                <ChefHat size={14} /> {tDynamic('Preparo na cozinha')}
              </button>
              <button type="button" onClick={() => setEstacaoPreparo('DIRETO')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                  estacaoPreparo === 'DIRETO'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'border-gray-200 text-gray-400 dark:border-gray-700'
                }`}>
                <Store size={14} /> Revenda direta
              </button>
            </div>
            <p className="mt-1.5 text-xs opacity-95 text-gray-400">
              {estacaoPreparo === 'DIRETO'
                ? 'Não entra na fila do KDS — o balcão separa e entrega direto (ex.: bebidas, sobremesas prontas).'
                : 'Entra na fila da cozinha (KDS). Use para itens que precisam de preparo.'}
            </p>
          </div>

          {/* Sprint 5: roteamento pro KDS por tickets — só aparece se a loja
              configurou estações (kds_estacoes). Produto sem seleção cai na
              estação Cozinha padrão (fn_despachar_kds_tickets). */}
          {estacoesKds.length > 0 && (
            <div className="rounded-2xl border p-3 dark:border-gray-800">
              <p className="mb-2 text-sm font-semibold dark:text-gray-200">{tDynamic('Tela do KDS que produz este item')}</p>
              <select
                value={estacaoKdsId}
                onChange={(e) => setEstacaoKdsId(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">{tDynamic('Padrão da loja (Cozinha)')}</option>
                {estacoesKds.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs opacity-95 text-gray-400">
                {tDynamic('Quando o pedido for aceito, este item vira um ticket independente na tela dessa estação.')}
              </p>
            </div>
          )}

          <div className="rounded-2xl border p-3 dark:border-gray-800">
            <p className="mb-2 text-sm font-semibold dark:text-gray-200">{tDynamic('Perfil operacional do produto')}</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['ALIMENTO', 'Alimento'],
                ['DRINK', 'Drink'],
                ['BEBIDA_PRONTA', 'Bebida pronta'],
              ] as const).map(([valorPerfil, rotulo]) => (
                <button
                  key={valorPerfil}
                  type="button"
                  onClick={() => {
                    setPerfilPreparo(valorPerfil);
                    if (valorPerfil === 'DRINK') {
                      setEstacaoPreparo('COZINHA');
                      const bar = estacoesKds.find((estacao) => estacao.nome.toLocaleLowerCase('pt-BR').includes('bar'));
                      if (bar) setEstacaoKdsId(bar.id);
                    }
                    if (valorPerfil === 'BEBIDA_PRONTA') setEstacaoPreparo('DIRETO');
                  }}
                  className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${perfilPreparo === valorPerfil ? 'border-purple-400 bg-purple-500/10 text-purple-700 dark:text-purple-300' : 'border-gray-200 text-gray-400 dark:border-gray-700'}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            {perfilPreparo === 'DRINK' && (
              <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-900/50 dark:bg-purple-950/20">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                    {tDynamic('Teor alcoólico final (% ABV)')}
                    <input value={teorAlcoolico} onChange={(event) => setTeorAlcoolico(event.target.value)} type="number" min="0" max="100" step="0.1" placeholder="Ex.: 18" className="mt-1 w-full rounded-lg border border-purple-200 bg-white p-2 text-sm dark:border-purple-900 dark:bg-gray-900" />
                  </label>
                  <label className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                    {tDynamic('Volume servido (ml)')}
                    <input value={volumePorcaoMl} onChange={(event) => setVolumePorcaoMl(event.target.value)} type="number" min="1" step="1" placeholder="Ex.: 300" className="mt-1 w-full rounded-lg border border-purple-200 bg-white p-2 text-sm dark:border-purple-900 dark:bg-gray-900" />
                  </label>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-purple-700 dark:text-purple-300">
                  {tDynamic('A ficha técnica abaixo vira a receita visível no KDS do bar. As calorias são calculadas pelo motor nutricional a partir dos ingredientes cadastrados.')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ficha técnica */}
        {controlaEstoque && (
          <div className="mt-4 rounded-2xl border p-3 dark:border-gray-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold dark:text-gray-200">{tDynamic('Ficha técnica (consumo de insumos)')}</p>
              <button type="button" onClick={sugerirFichaIA} disabled={sugerindoFicha || !nome.trim() || !insumos.length}
                className="flex items-center gap-1.5 rounded-lg bg-orange-100 px-2.5 py-1.5 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-200 disabled:opacity-50 dark:bg-orange-900/30 dark:text-orange-400">
                <Sparkles size={13} className={sugerindoFicha ? 'animate-pulse' : ''} /> {sugerindoFicha ? tDynamic('Sugerindo…') : tDynamic('Sugerir com IA')}
              </button>
            </div>
            {avisoFichaIA && (
              <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-orange-50 p-2 text-[11px] leading-relaxed text-orange-800 dark:bg-orange-950/20 dark:text-orange-300">
                <Sparkles size={12} className="mt-0.5 shrink-0" /> {avisoFichaIA}
              </p>
            )}
            {ficha.map((f, idx) => {
              const insumoDaLinha = insumos.find((i) => i.id === f.insumo_id);
              const equivalencia = insumoDaLinha
                ? equivalenteFisico(insumoDaLinha.unidade_medida, insumoDaLinha.detalhes_rendimento?.regras, insumoDaLinha.detalhes_rendimento?.equivalencias)
                : null;
              const qtdNum = Number(f.quantidade_consumida);
              return (
                <div key={idx} className="mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <SeletorInsumo
                      insumos={insumos}
                      valor={f.insumo_id}
                      jaUsados={ficha.map((x) => x.insumo_id)}
                      onChange={(insumoId) => setFicha((arr) => arr.map((x, i) => i === idx ? { ...x, insumo_id: insumoId } : x))}
                    />
                    <input value={f.quantidade_consumida} onChange={(e) => setFicha((arr) => arr.map((x, i) => i === idx ? { ...x, quantidade_consumida: e.target.value } : x))}
                      type="number" placeholder={insumoDaLinha ? tDynamic('Qtd em') + ' ' + insumoDaLinha.unidade_medida : 'Qtd'}
                      className="w-24 rounded-lg border p-1.5 text-xs" />
                    <button type="button" onClick={() => setFicha((arr) => arr.filter((_, i) => i !== idx))} className="text-red-400"><X size={14} /></button>
                  </div>
                  {equivalencia && (
                    <p className="pl-1 pt-0.5 text-[11px] text-gray-400">
                      1 {insumoDaLinha!.unidade_medida} ≈ {equivalencia.valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {equivalencia.unidade}
                      {qtdNum > 0 && (
                        <> · {qtdNum} {insumoDaLinha!.unidade_medida} = <b className="text-gray-600 dark:text-gray-300">{(qtdNum * equivalencia.valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {equivalencia.unidade}</b> {tDynamic('nesta receita')}</>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
            <button type="button" onClick={addInsumoFicha} disabled={!insumos.length} className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--cor-primaria)] disabled:opacity-40">
              <Plus size={12} /> Adicionar insumo
            </button>
            {!insumos.length && <p className="mt-1 text-xs text-gray-400">{tDynamic('Cadastre insumos em Estoque primeiro.')}</p>}
             {ficha.length > 0 && (
              <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                 <div className="grid grid-cols-4 gap-2 text-center text-xs opacity-90 sm:text-xs">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 border border-gray-100 dark:border-gray-700">
                      <p className="uppercase tracking-wide text-gray-400 mb-1">Preço PDV</p>
                      <p className="font-semibold dark:text-gray-200">{fmt(precoNum)}</p>
                      {isIfoodActive && <p className="text-xs opacity-80 text-red-500 font-bold mt-0.5">iFood: {fmt(markupIfood)}</p>}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 border border-gray-100 dark:border-gray-700">
                      <p className="uppercase tracking-wide text-gray-400 mb-1">Insumos</p>
                      <p className="font-semibold text-orange-600 dark:text-orange-400">-{fmt(custoInsumos)}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 border border-gray-100 dark:border-gray-700">
                      <p className="uppercase tracking-wide text-gray-400 mb-1">Despesas</p>
                      <p className="font-semibold text-orange-600 dark:text-orange-400">-{fmt(rateioFixo)}</p>
                    </div>
                    <div className={`${lucroLiquidoReal < 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50'} rounded-lg p-2 border`}>
                      <p className="uppercase tracking-wide text-gray-400 mb-1 flex items-center justify-center gap-1">Líq. Real</p>
                      <p className={`font-black ${lucroLiquidoReal < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{fmt(lucroLiquidoReal)}</p>
                      <p className={`text-xs opacity-80 font-bold mt-0.5 ${margemReal < 20 ? 'text-red-500' : 'text-green-600'}`}>{margemReal.toFixed(0)}%</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* Nutrição — fora do bloco de estoque de propósito: revenda não tem
            ficha técnica e mesmo assim publica tabela (vem do rótulo). */}
        <NutricaoDoPrato
          lojaId={lojaId}
          ficha={ficha}
          insumos={insumos}
          config={nutriConfig}
          onConfigChange={setNutriConfig}
        />

        {/* Personalizações do item: instruções como ponto da carne pertencem
            ao item do pedido e viajam até o KDS; nunca são etapas do workflow. */}
        <div className="mt-4 rounded-2xl border p-3 dark:border-gray-800">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold dark:text-gray-200">{tDynamic('Personalizações do item')}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {tDynamic('Ponto da carne, tamanho, recheio, gelo e limão aparecem no item do pedido e no cartão do KDS — não viram etapas da cozinha.')}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={sugerirExtrasIA} disabled={sugerindoExtras || !nome.trim()}
                className="min-h-11 flex items-center gap-1.5 rounded-xl bg-orange-100 px-3 text-xs font-black text-orange-600 hover:bg-orange-200 disabled:opacity-50 dark:bg-orange-900/30 dark:text-orange-400">
                <Sparkles size={14} className={sugerindoExtras ? 'animate-pulse' : ''} /> {sugerindoExtras ? tDynamic('Sugerindo…') : tDynamic('Sugerir extras com IA')}
              </button>
              <button type="button" onClick={addGrupoPontoCarne} className="min-h-11 rounded-xl border border-orange-300 bg-orange-50 px-3 text-xs font-black text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
                + {tDynamic('Ponto da carne obrigatório')}
              </button>
            </div>
          </div>
          {avisoExtrasIA && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-orange-50 p-2 text-[11px] leading-relaxed text-orange-800 dark:bg-orange-950/20 dark:text-orange-300">
              <Sparkles size={12} className="mt-0.5 shrink-0" /> {avisoExtrasIA}
            </p>
          )}
          {grupos.map((g) => {
            const opcoesValidasDoGrupo = g.opcoes.filter((o) => o.nome.trim()).length;
            return (
            <div key={g._key} className="mb-2 rounded-xl bg-gray-50 p-2 dark:bg-gray-800">
              <div className="flex items-end gap-1.5">
                <label className="flex-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  {tDynamic('Nome do grupo')}
                  <input value={g.nome} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key ? { ...x, nome: e.target.value } : x))}
                    placeholder="Ex.: Extras" className="mt-0.5 w-full rounded-lg border p-1.5 text-xs font-normal normal-case" />
                </label>
                <label className="w-16 text-[10px] font-bold uppercase tracking-wide text-gray-400" title={tDynamic('0 = o cliente pode pular este grupo. 1 ou mais = obrigatório escolher.')}>
                  {tDynamic('Mín.')}
                  <input value={g.min_escolhas} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key ? { ...x, min_escolhas: Number(e.target.value) } : x))}
                    type="number" min={0} className="mt-0.5 w-full rounded-lg border p-1.5 text-xs font-normal" />
                </label>
                <label className="w-16 text-[10px] font-bold uppercase tracking-wide text-gray-400" title={tDynamic('Quantas opções deste grupo o cliente pode marcar ao mesmo tempo. 1 = só uma (vira botão único); mais que 1 = várias ao mesmo tempo.')}>
                  {tDynamic('Máx.')}
                  <input value={g.max_escolhas} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key ? { ...x, max_escolhas: Number(e.target.value) } : x))}
                    type="number" min={1} className="mt-0.5 w-full rounded-lg border p-1.5 text-xs font-normal" />
                </label>
                <button type="button" onClick={() => setGrupos((arr) => arr.filter((x) => x._key !== g._key))} className="mb-1.5 text-red-400"><Trash2 size={14} /></button>
              </div>
              <p className="mt-1 pl-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {tDynamic('Como o cliente vê:')}{' '}
                <b className="text-gray-700 dark:text-gray-300">
                  {g.min_escolhas > 0 ? tDynamic('obrigatório') : tDynamic('opcional')}
                  {' · '}
                  {g.max_escolhas === 1 ? tDynamic('escolha 1') : `${tDynamic('até')} ${g.max_escolhas}`}
                </b>
                {opcoesValidasDoGrupo > 1 && g.max_escolhas === 1 && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                    {tDynamic('— o cliente só marca uma destas opções por vez. Para permitir várias juntas, aumente o Máx.')}
                  </span>
                )}
              </p>
              <div className="mt-1.5 space-y-1 pl-2">
                {g.opcoes.length > 0 && (
                  <p className="pl-1 text-[10px] font-medium text-gray-400">
                    {tDynamic('Nome da opção · quanto soma no preço ao ser escolhida · (opcional) qual insumo baixa do estoque')}
                  </p>
                )}
                {g.opcoes.map((o) => {
                  const insumoDaOpcao = insumos.find((i) => i.id === o.insumo_id);
                  const equivalenciaOpcao = insumoDaOpcao
                    ? equivalenteFisico(insumoDaOpcao.unidade_medida, insumoDaOpcao.detalhes_rendimento?.regras, insumoDaOpcao.detalhes_rendimento?.equivalencias)
                    : null;
                  const qtdInsumoNum = Number(o.quantidade_insumo) || 0;
                  return (
                  <div key={o._key} className="flex flex-col gap-1.5 border-b border-gray-200 dark:border-gray-800 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                    <div className="flex items-center gap-1.5">
                      <input value={o.nome} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key
                        ? { ...x, opcoes: x.opcoes.map((y) => y._key === o._key ? { ...y, nome: e.target.value } : y) } : x))}
                        placeholder="Opção (ex: Cebola roxa)" className="flex-1 rounded-lg border p-1.5 text-xs" />
                      <CampoPreco value={String(o.preco_adicional)} onChange={(v) => setGrupos((arr) => arr.map((x) => x._key === g._key
                        ? { ...x, opcoes: x.opcoes.map((y) => y._key === o._key ? { ...y, preco_adicional: Number(v) || 0 } : y) } : x))}
                        placeholder="0,00" className="w-28 shrink-0 text-xs" />
                      <button type="button" onClick={() => setGrupos((arr) => arr.map((x) => x._key === g._key
                        ? { ...x, opcoes: x.opcoes.filter((y) => y._key !== o._key) } : x))} className="text-red-400"><X size={13} /></button>
                    </div>
                    {/* Vínculo de Estoque do Adicional */}
                    <div className="flex flex-col gap-1 pl-2">
                      <div className="flex items-center gap-1.5">
                        <SeletorInsumo
                          insumos={insumos}
                          valor={o.insumo_id || ''}
                          permiteLimpar
                          placeholder={tDynamic('Sem baixa de estoque — toque para vincular')}
                          onChange={(insumoId) => setGrupos((arr) => arr.map((x) => x._key === g._key
                            ? { ...x, opcoes: x.opcoes.map((y) => y._key === o._key ? { ...y, insumo_id: insumoId || null, quantidade_insumo: insumoId ? y.quantidade_insumo : null } : y) } : x))}
                        />
                        {o.insumo_id && (
                          <input value={o.quantidade_insumo || ''} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key
                            ? { ...x, opcoes: x.opcoes.map((y) => y._key === o._key ? { ...y, quantidade_insumo: Number(e.target.value) } : y) } : x))}
                            type="number" placeholder={tDynamic('Qtd em') + ' ' + (insumos.find((i) => i.id === o.insumo_id)?.unidade_medida ?? '')}
                            className="w-28 rounded-lg border border-dashed border-gray-300 p-1.5 text-xs" />
                        )}
                      </div>
                      {o.insumo_id && !o.quantidade_insumo && (
                        <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          {tDynamic('Sem quantidade, o sistema assume 1 por unidade do pedido ao baixar o estoque.')}
                        </p>
                      )}
                      {equivalenciaOpcao && (
                        <p className="text-[11px] text-gray-400">
                          1 {insumoDaOpcao!.unidade_medida} ≈ {equivalenciaOpcao.valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {equivalenciaOpcao.unidade}
                          {qtdInsumoNum > 0 && (
                            <> · {qtdInsumoNum} {insumoDaOpcao!.unidade_medida} = <b className="text-gray-600 dark:text-gray-300">{(qtdInsumoNum * equivalenciaOpcao.valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {equivalenciaOpcao.unidade}</b> {tDynamic('por unidade do pedido')}</>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  );})}
                <button type="button" onClick={() => addOpcao(g._key)} className="flex items-center gap-1 text-xs font-medium text-[var(--cor-primaria)]">
                  <Plus size={12} /> Opção
                </button>
              </div>
            </div>
          );})}
          <button type="button" onClick={addGrupo} className="min-h-11 flex items-center gap-1 text-xs font-medium text-[var(--cor-primaria)]">
            <Plus size={12} /> {tDynamic('Novo grupo de personalização')}
          </button>
        </div>

        {erro && <p className="mt-2 text-sm font-medium text-red-500">{erro}</p>}

        <button type="button" onClick={salvar} disabled={salvando}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 font-semibold text-white disabled:opacity-40">
          <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar produto'}
        </button>
      </div>

      {mostrarPreview && (
        <>
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center">
            <span className="mt-3 flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-1.5 text-xs font-black text-white shadow-lg dark:bg-white dark:text-gray-900">
              <Eye size={13} /> {tDynamic('Pré-visualização — é assim que o cliente vê este produto. Nada aqui é salvo.')}
            </span>
          </div>
          <ModalOpcoes produto={produtoPreview} onFechar={() => setMostrarPreview(false)} onConfirmar={() => setMostrarPreview(false)} />
        </>
      )}
    </div>
  );
}

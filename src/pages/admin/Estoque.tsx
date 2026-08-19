import { useCallback, useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AlertTriangle, Plus, Pencil, Calculator, Trash2, ArrowRight, ArchiveRestore, Loader2, Search, Scale, ClipboardCheck, Scissors, CheckCircle2, Apple } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, TipoItem, fmt, InsumoRendimentoJSON } from '../../types';
import { UNIDADES, destinosPermitidos, validarConversao, opcoesDeEntrada } from '../../lib/unidades';
import { OPCOES_SETOR, SETORES, validarSetor, derivarSetor } from '../../lib/estoque3d/rastreio/setores';
import type { CtxLoja } from './AdminLayout';
import MiseOnLoader from '../../components/MiseOnLoader';
import EstoquePreparos from './EstoquePreparos';
import { SimuladorCusto } from '../../components/custeio';
import type { ItemEstoque, FatorItem } from '../../lib/custeio';
import { ModalReposicaoBuffet } from '../../components/estoque/ModalReposicaoBuffet';
import ModalInventario from '../../components/estoque/ModalInventario';
import ModalTransformar from '../../components/estoque/ModalTransformar';

// three.js pesa ~600 KB: só entra no bundle de quem abrir a aba 3D.
const EstoqueCusto3D = lazy(() => import('../../lib/estoque3d/EstoqueCusto3D'));
const EstoqueRastreio3D = lazy(() => import('../../lib/estoque3d/rastreio/EstoqueRastreio3D'));
import ModalRaioXProduto from '../../components/estoque/ModalRaioXProduto';
import ModalNutricaoInsumo from '../../components/estoque/ModalNutricaoInsumo';
import ScannerQRCodeModal from '../../components/estoque/ScannerQRCodeModal';
import ModalImportarNFCe from '../../components/estoque/ModalImportarNFCe';
import { BarChart3, QrCode } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

// Só insumo que vira comida tem tabela nutricional — álcool em gel,
// uniforme e material de escritório não entram (mesmo critério do
// tipo_item.entra_ficha_tecnica da ERP Onda 0, restrito ao que é ingerível).
const TIPOS_COM_NUTRICAO: readonly TipoItem[] = ['INGREDIENTE', 'PREPARO', 'REVENDA'];
const ehTipoComNutricao = (tipo?: TipoItem) => !!tipo && TIPOS_COM_NUTRICAO.includes(tipo);

export default function Estoque() {
  const { tDynamic } = useI18n();
  const { lojaId, segmento_negocio, modulos_ativos } = useOutletContext<CtxLoja>();
  const isBuffet = segmento_negocio === 'SELF_SERVICE' || modulos_ativos?.balanca === true;
  const [tab, setTab] = useState<'insumos' | 'preparos' | 'custo3d' | 'rastreio3d'>('insumos');
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [inativos, setInativos] = useState<Insumo[]>([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  const [raioXInsumo, setRaioXInsumo] = useState<Insumo | null>(null);
  const [nutricaoInsumo, setNutricaoInsumo] = useState<Insumo | null>(null);
  // Pra lojista discernir de longe quem já tem nutrição pronta, quem tem
  // sugestão esperando revisão, e quem ainda nem foi tocado — sem abrir modal.
  const [statusNutricao, setStatusNutricao] = useState<Record<string, 'completo' | 'pendente'>>({});

  // Buffet / Quilo
  const [modalBuffetAberto, setModalBuffetAberto] = useState(false);

  // Inventário e transformação (monta/desmonta). `undefined` = modal fechado;
  // `null` = aberto sem insumo pré-selecionado.
  const [inventarioAberto, setInventarioAberto] = useState(false);
  const [transformando, setTransformando] = useState<Insumo | null | undefined>(undefined);
  const [avisoEstoque, setAvisoEstoque] = useState<string | null>(null);

  // NFC-e Scanner & Importação
  const [modalScannerAberto, setModalScannerAberto] = useState(false);
  const [dadosNotaImportada, setDadosNotaImportada] = useState<any | null>(null);
  const [consultandoNota, setConsultandoNota] = useState(false);

  const processarQRCode = async (entrada: string) => {
    setConsultandoNota(true);
    try {
      const isUrl = entrada.includes('http://') || entrada.includes('https://');
      if (!isUrl) {
        alert(
          'Só a chave de acesso não basta. A SEFAZ exige o código de segurança que fica dentro do QR Code, ' +
          'e ele não pode ser deduzido da chave. Escaneie o QR Code impresso no cupom.'
        );
        return;
      }

      const { data, error } = await supabase.functions.invoke('nfe-importar-qrcode', {
        body: { url_qrcode: entrada }
      });

      const msgErro = (data as any)?.error;
      if (error || !data || msgErro) {
        alert(`Erro ao consultar nota na SEFAZ: ${msgErro || error?.message || 'Tente novamente.'}`);
      } else {
        setModalScannerAberto(false);
        setDadosNotaImportada(data);
      }
    } catch (err: any) {
      alert(`Falha de conexão com a SEFAZ: ${err?.message || err}`);
    } finally {
      setConsultandoNota(false);
    }
  };

  // States para Novo Insumo Dinâmico
  const [modoCadastro, setModoCadastro] = useState<'RAPIDO' | 'AVANCADO'>('RAPIDO');
  const [nome, setNome] = useState('');
  const [categoriaInsumo, setCategoriaInsumo] = useState('Ingrediente');
  const [setor, setSetor] = useState('');
  const [unidadeDireta, setUnidadeDireta] = useState('un');
  const [isNovaCategoria, setIsNovaCategoria] = useState(false);
  const [nomeNovaCategoria, setNomeNovaCategoria] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  
  // Compra
  const [unidadeCompra, setUnidadeCompra] = useState('pct');
  const [precoCompra, setPrecoCompra] = useState('');
  const [qtdEstoqueCompra, setQtdEstoqueCompra] = useState('');
  
  // Uso (Rendimento) - Multi-step
  type PassoRendimento = { id: string; rendimento: string; unidade: string };
  const [passosRendimento, setPassosRendimento] = useState<PassoRendimento[]>([
     { id: '1', rendimento: '1', unidade: 'un' }
  ]);
  
  // Valida a cadeia inteira (compra → passo 1 → passo 2 → ...): cada passo
  // herda a unidade do anterior como origem, então uma quebra ilegal no meio
  // contamina todo o custo a jusante.
  const errosCadeia: string[] = [];
  {
    let origem = unidadeCompra;
    for (const passo of passosRendimento) {
      const v = validarConversao(origem, passo.unidade, 1, Number(passo.rendimento) || 0);
      if (!v.ok && v.mensagem) errosCadeia.push(v.mensagem);
      origem = passo.unidade;
    }
  }
  const cadeiaValida = errosCadeia.length === 0;

  // Trocar a unidade de compra pode tornar ilegal um destino já escolhido
  // (ex.: compra vira "kg" com um passo que rende "kg"). Realinha para o
  // primeiro destino permitido em vez de deixar o form num estado inválido.
  useEffect(() => {
    setPassosRendimento(passos => {
      let origem = unidadeCompra;
      let mudou = false;
      const corrigidos = passos.map(p => {
        const permitidos = destinosPermitidos(origem);
        const unidade = permitidos.some(u => u.codigo === p.unidade)
          ? p.unidade
          : (permitidos[0]?.codigo ?? p.unidade);
        if (unidade !== p.unidade) mudou = true;
        origem = unidade;
        return unidade === p.unidade ? p : { ...p, unidade };
      });
      return mudou ? corrigidos : passos;
    });
  }, [unidadeCompra]);

  const [editando, setEditando] = useState<Insumo | null>(null);
  const [estoqueMinimo, setEstoqueMinimo] = useState('');

  const itemVirtual: ItemEstoque = useMemo(() => {
    const fatores: FatorItem[] = [];
    let origem = unidadeCompra;
    for (const p of passosRendimento) {
      const mult = Number(p.rendimento) || 1;
      if (mult > 0 && p.unidade !== origem) {
        fatores.push({ de: origem, para: p.unidade, multiplicador: mult });
        origem = p.unidade;
      }
    }
    const unidadeBase = passosRendimento[passosRendimento.length - 1]?.unidade || unidadeCompra;
    const precoEmb = Number(precoCompra || 0);
    const rendEmb = passosRendimento.reduce((acc, p) => acc * (Number(p.rendimento) || 1), 1);
    const qtdBase = Number(qtdEstoqueCompra || 1) * rendEmb;
    const custoTot = precoEmb > 0 ? precoEmb * Number(qtdEstoqueCompra || 1) : 0;

    return {
      id: editando?.id || 'novo',
      nome: nome || 'Insumo',
      unidadeBase,
      fatores,
      lotes: [{
        id: 'lote-form',
        data: new Date().toISOString(),
        quantidade: qtdBase > 0 ? qtdBase : 1,
        custoTotal: custoTot,
      }],
    };
  }, [unidadeCompra, passosRendimento, precoCompra, qtdEstoqueCompra, editando?.id, nome]);
  const [entrada, setEntrada] = useState<{
    insumo: Insumo; qtd: string; unidade: string; custo: string; lote?: string; validade?: string;
    /** Rendimento declarado na hora, quando a unidade não está no cadastro. */
    rendimentoNovo: string;
    lembrarConversao: boolean;
  } | null>(null);

  // Unidades aceitas na entrada do insumo aberto no modal, com o fator para a
  // unidade-base do saldo. Recalcula só quando troca o insumo.
  const insumoEntrada = entrada?.insumo;
  const opcoesEntrada = useMemo(
    () => insumoEntrada
      ? opcoesDeEntrada(insumoEntrada.unidade_medida, insumoEntrada.detalhes_rendimento?.regras, insumoEntrada.detalhes_rendimento?.equivalencias)
      : [],
    [insumoEntrada],
  );
  const opcaoEntrada = opcoesEntrada.find(o => o.codigo === entrada?.unidade);
  // Unidade fora do cadastro (chegou cabeça de alho num item comprado em kg):
  // o lojista declara o rendimento aqui mesmo, sem ter que reeditar o insumo.
  const unidadeAvulsa = !!entrada && !opcaoEntrada;
  const validacaoAvulsa = entrada && unidadeAvulsa
    ? validarConversao(entrada.unidade, entrada.insumo.unidade_medida, 1, Number(entrada.rendimentoNovo) || 0)
    : null;
  const fatorEntrada = opcaoEntrada
    ? opcaoEntrada.fatorParaBase
    : (validacaoAvulsa?.ok ? Number(entrada?.rendimentoNovo || 0) : 0);
  const qtdEntradaBase = Number(entrada?.qtd || 0) * fatorEntrada;

  const abrirEntrada = (i: Insumo) => setEntrada({
    insumo: i, qtd: '', custo: '', rendimentoNovo: '', lembrarConversao: true,
    unidade: opcoesDeEntrada(i.unidade_medida, i.detalhes_rendimento?.regras, i.detalhes_rendimento?.equivalencias)[0]?.codigo ?? i.unidade_medida,
  });

  // `carregar()` apenas incrementa a versao; quem busca de fato e o effect abaixo.
  // Antes isto era `useEffect(() => { setTimeout(carregar, 0); }, [lojaId])` — o
  // setTimeout existia so para escapar da regra set-state-in-effect, nao por
  // necessidade de timing, e escondia o warning de dependencia.
  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let atual = true;
    supabase.from('insumos').select('*, fichas_preparos!fichas_preparos_preparo_id_fkey(*)')
      .eq('loja_id', lojaId).order('nome')
      .then(({ data, error }) => {
        if (!atual) return;
        if (error) console.error('Erro ao carregar insumos:', error);
        const todos = (data as Insumo[]) ?? [];
        setInsumos(todos.filter((i) => i.ativo));
        setInativos(todos.filter((i) => !i.ativo));
      });

    supabase.from('insumos_nutricao').select('insumo_id, revisado, nutrientes').eq('loja_id', lojaId)
      .then(({ data, error }) => {
        if (!atual || error) return;
        const mapa: Record<string, 'completo' | 'pendente'> = {};
        for (const r of data ?? []) {
          const temValor = r.nutrientes && Object.keys(r.nutrientes).length > 0;
          mapa[r.insumo_id] = r.revisado && temValor ? 'completo' : 'pendente';
        }
        setStatusNutricao(mapa);
      });

    // Não buscamos mais produtos de buffet do PDV, a Pista consome Preparos.
    return () => { atual = false; };
  }, [lojaId, versao]);

  // 23505 = violacao do indice uq_insumos_loja_nome_ativo (nome repetido entre
  // insumos ativos da mesma loja, ignorando espacos e caixa).
  const avisarErroInsumo = (error: { code?: string; message: string }, nomeLimpo: string) => {
    alert(error.code === '23505'
      ? `Já existe um insumo ativo chamado "${nomeLimpo}". Use o existente ou escolha outro nome.`
      : `Não foi possível salvar: ${error.message}`);
  };

  const normalizeString = (str: string) => 
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  const criar = async () => {
    // btrim tambem roda no banco (trigger tg_insumos_normaliza_nome), mas o nome
    // limpo aqui e o que vai para a checagem de duplicata e para a mensagem de erro.
    const nomeLimpo = nome.trim();
    // Guard de duplo-clique: sem ele, dois cliques rapidos criavam dois insumos
    // identicos, cada um com seu proprio saldo e ficha tecnica.
    if (!nomeLimpo || salvando) return;

    const nomeNorm = normalizeString(nomeLimpo);
    const duplicadoExato = [...insumos, ...inativos].find(i => normalizeString(i.nome) === nomeNorm && i.id !== editando?.id);
    if (duplicadoExato) {
      alert(`Já existe um insumo (mesmo que inativo) chamado "${duplicadoExato.nome}"! A busca é inteligente e entende que "${nomeLimpo}" é a mesma coisa. Evite criar itens duplicados.`);
      return;
    }

    // Alerta inteligente para evitar "Alho" vs "Alho Dente"
    const palavras = nomeNorm.split(' ');
    const unidadesComuns = ['dente', 'dentes', 'cabeca', 'cabecas', 'maco', 'macos', 'folha', 'folhas', 'rodela', 'rodelas', 'kg', 'quilo', 'grama', 'gramas', 'litro', 'litros', 'ml', 'unidade', 'unidades'];
    const temUnidadeNoNome = palavras.some(p => unidadesComuns.includes(p));
    
    if (temUnidadeNoNome && !editando) {
      const baseName = palavras.filter(p => !unidadesComuns.includes(p)).join(' ');
      if (baseName.length >= 3) {
        const parecido = [...insumos, ...inativos].find(i => normalizeString(i.nome) === baseName || normalizeString(i.nome).includes(baseName));
        if (parecido) {
           const confirma = window.confirm(`🚨 ALERTA DE ORGANIZAÇÃO:\n\nVocê está tentando cadastrar "${nomeLimpo}", mas já tem "${parecido.nome}" no estoque.\n\nLembre-se: No MiseOn, você NÃO PRECISA criar "Alho Dente" e "Alho Cabeça". Você cadastra apenas "Alho" e usa o Passo 2 ali embaixo para dizer que a unidade de uso dele é em "dentes" ou "cabeças".\n\nDeseja criar esse item duplicado mesmo assim?`);
           if (!confirma) return;
        }
      }
    }

    // Se estiver em modo RAPIDO, força a unidade de compra e o rendimento para 1:1 com a unidade direta
    const uCompra = modoCadastro === 'RAPIDO' ? unidadeDireta : unidadeCompra;
    const pRendimento = modoCadastro === 'RAPIDO' 
      ? [{ id: '1', rendimento: '1', unidade: unidadeDireta }]
      : passosRendimento;

    // Defesa em profundidade: a UI já filtra os destinos ilegais, mas o save
    // recusa de novo — um estado antigo ou colado à mão não pode furar a regra.
    if (modoCadastro === 'AVANCADO' && !cadeiaValida) {
      alert(`Conversão inválida:\n\n${errosCadeia.join('\n')}`);
      return;
    }
    setSalvando(true);
    try {
    const qtdEstoque = Number(qtdEstoqueCompra || 0);
    const precoEmb = Number(precoCompra || 0);
    const rendEmb = pRendimento.reduce((acc, p) => acc * (Number(p.rendimento) || 1), 1);
    const unidadeUso = pRendimento[pRendimento.length - 1].unidade;
    const estoqueFinal = qtdEstoque * rendEmb;
    
    let jsonRegras: InsumoRendimentoJSON | null = null;
    if (modoCadastro === 'AVANCADO' && (pRendimento.length > 1 || pRendimento[0].unidade !== uCompra || Number(pRendimento[0].rendimento) !== 1)) {
       jsonRegras = { regras: [] };
       let unidadeAtual = uCompra;
       for (const passo of pRendimento) {
          jsonRegras.regras.push({
             de_qtd: 1, de_unidade: unidadeAtual,
             para_qtd: Number(passo.rendimento), para_unidade: passo.unidade
          });
          unidadeAtual = passo.unidade;
       }
    }
    
    // Atalhos de entrada aprendidos não aparecem neste form; sem carregá-los de
    // volta, salvar o insumo os apagaria em silêncio. Os que apontam para outra
    // unidade-base morrem junto com a base antiga — o fator não valeria mais.
    const equivalencias = (editando?.detalhes_rendimento?.equivalencias ?? [])
      .filter(e => e.rende_unidade === unidadeUso);
    if (equivalencias.length > 0) {
      jsonRegras = { regras: jsonRegras?.regras ?? [], equivalencias };
    }

    const categoriaFinal = isNovaCategoria ? nomeNovaCategoria : categoriaInsumo;
    
    const payload = {
      loja_id: lojaId,
      nome: nomeLimpo,
      unidade_medida: unidadeUso,
      quantidade_atual: estoqueFinal,
      estoque_minimo: Number(estoqueMinimo || 0),
      preco_embalagem: precoEmb,
      qtd_embalagem: rendEmb,
      detalhes_rendimento: jsonRegras,
      categoria_insumo: categoriaFinal,
      setor: setor || null
    };

    if (editando) {
       const { error } = await supabase.from('insumos').update(payload).eq('id', editando.id);
       if (error) return avisarErroInsumo(error, nomeLimpo);
    } else {
       const { data, error } = await supabase.from('insumos').insert(payload).select('id').single();
       if (error) return avisarErroInsumo(error, nomeLimpo);
       if (data && estoqueFinal > 0) {
         await supabase.from('movimentacoes_estoque').insert({
           loja_id: lojaId, insumo_id: data.id, tipo: 'ENTRADA', quantidade: estoqueFinal, motivo: 'Saldo inicial',
         });
       }
    }

    cancelarEdicao();
    carregar();
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (i: Insumo) => {
    setEditando(i);
    setNome(i.nome);
    setCategoriaInsumo(i.categoria_insumo || 'Ingrediente');
    setSetor(i.setor ?? '');
    setIsNovaCategoria(false);
    setNomeNovaCategoria('');
    setEstoqueMinimo(String(i.estoque_minimo || ''));
    
    if (i.detalhes_rendimento?.regras && i.detalhes_rendimento.regras.length > 0) {
       setModoCadastro('AVANCADO');
       setUnidadeCompra(i.detalhes_rendimento.regras[0].de_unidade);
       setPassosRendimento(i.detalhes_rendimento.regras.map((r: any, idx: number) => ({
          id: String(idx), rendimento: String(r.para_qtd), unidade: r.para_unidade
       })));
       setQtdEstoqueCompra(String(Number(i.quantidade_atual) / Number(i.qtd_embalagem)));
    } else {
       setModoCadastro('RAPIDO');
       setUnidadeDireta(i.unidade_medida);
       setUnidadeCompra(i.unidade_medida);
       setPassosRendimento([{ id: '1', rendimento: '1', unidade: i.unidade_medida }]);
       setQtdEstoqueCompra(String(i.quantidade_atual));
    }
    setPrecoCompra(String(i.preco_embalagem || ''));
    setTimeout(() => {
      document.getElementById('form-novo-insumo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('input-nome-insumo')?.focus();
    }, 150);
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setModoCadastro('RAPIDO');
    setNome(''); setQtdEstoqueCompra(''); setEstoqueMinimo(''); setPrecoCompra(''); setCategoriaInsumo('Ingrediente'); setSetor('');
    setUnidadeDireta('un');
    setIsNovaCategoria(false); setNomeNovaCategoria('');
    setPassosRendimento([{ id: '1', rendimento: '1', unidade: 'un' }]); setUnidadeCompra('pct');
  };

  const registrarEntrada = async () => {
    if (!entrada || !entrada.qtd) return;
    // O saldo mora na unidade de uso; a digitada é só a lente do lojista.
    const qtd = qtdEntradaBase;
    if (!(qtd > 0)) return;
    const base = entrada.insumo.unidade_medida;

    const patch: Record<string, unknown> = {
      quantidade_atual: Number(entrada.insumo.quantidade_atual) + qtd,
    };
    // Atalho aprendido: da próxima vez "cabeça" já aparece na lista do insumo.
    if (unidadeAvulsa && entrada.lembrarConversao) {
      const atual = entrada.insumo.detalhes_rendimento;
      patch.detalhes_rendimento = {
        regras: atual?.regras ?? [],
        equivalencias: [
          ...(atual?.equivalencias ?? []).filter(e => e.unidade !== entrada.unidade),
          { unidade: entrada.unidade, rende_qtd: fatorEntrada, rende_unidade: base },
        ],
      };
    }
    await supabase.from('insumos').update(patch).eq('id', entrada.insumo.id);
    await supabase.from('movimentacoes_estoque').insert({
      loja_id: lojaId,
      insumo_id: entrada.insumo.id,
      tipo: 'ENTRADA',
      quantidade: qtd,
      custo_total: Number(entrada.custo || 0),
      // Guarda o que foi digitado: sem isso, "45 un" no histórico esconde que
      // a compra foi de 5 kg e o erro de conversão fica invisível na auditoria.
      motivo: entrada.unidade === base ? 'Compra' : `Compra (${entrada.qtd} ${entrada.unidade})`,
      lote_fornecedor: entrada.lote || null,
      vence_em: entrada.validade || null
    });
    setEntrada(null);
    carregar();
  };

  const removerEquivalencia = async (i: Insumo, unidade: string) => {
    if (!window.confirm(`Remover a conversão de entrada "1 ${unidade}" de ${i.nome}?\n\nO estoque já lançado não muda — só deixa de aparecer como opção nas próximas entradas.`)) return;
    const equivalencias = (i.detalhes_rendimento?.equivalencias ?? []).filter(e => e.unidade !== unidade);
    const { error } = await supabase.from('insumos')
      .update({ detalhes_rendimento: { regras: i.detalhes_rendimento?.regras ?? [], equivalencias } })
      .eq('id', i.id);
    if (error) { alert(`Não foi possível remover: ${error.message}`); return; }
    carregar();
  };

  const toggleAtivo = async (i: Insumo) => {
    if (window.confirm(`Tem certeza que deseja ${i.ativo ? 'arquivar (excluir)' : 'reativar'} o insumo ${i.nome}?`)) {
      const { error } = await supabase.from('insumos').update({ ativo: !i.ativo }).eq('id', i.id);
      if (error) {
        // Reativar um homonimo colide com o insumo ativo de mesmo nome.
        alert(error.code === '23505'
          ? `Nao da para reativar: ja existe um insumo ativo chamado "${i.nome}". Renomeie um dos dois.`
          : `Nao foi possivel alterar: ${error.message}`);
        return;
      }
      carregar();
    }
  };

  const criticos = insumos.filter((i) => !i.is_preparo && Number(i.quantidade_atual) <= Number(i.estoque_minimo));
  
  const termoBusca = normalizeString(busca.trim());
  const insumosBrutos = insumos.filter(i => 
    !i.is_preparo && 
    (!filtroCategoria || i.categoria_insumo === filtroCategoria || (filtroCategoria === 'Ingrediente' && !i.categoria_insumo)) &&
    (!termoBusca || normalizeString(i.nome).includes(termoBusca) || normalizeString(i.unidade_medida || '').includes(termoBusca))
  );
  const inativosBrutos = inativos.filter(i => 
    !i.is_preparo && 
    (!filtroCategoria || i.categoria_insumo === filtroCategoria || (filtroCategoria === 'Ingrediente' && !i.categoria_insumo)) &&
    (!termoBusca || normalizeString(i.nome).includes(termoBusca) || normalizeString(i.unidade_medida || '').includes(termoBusca))
  );

  const categoriasDoBanco = Array.from(new Set([...insumos, ...inativos].map(i => i.categoria_insumo).filter(Boolean))) as string[];
  const categoriasUnicas = Array.from(new Set(['Ingrediente', 'Revenda Direta', 'Embalagem', 'Limpeza', ...categoriasDoBanco]));

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
         <div className="flex items-center gap-3">
            <h2 className="font-black text-2xl dark:text-gray-100">{tDynamic('Estoque Geral')}</h2>
             {isBuffet && (
               <button
                 onClick={() => setModalBuffetAberto(true)}
                 className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md hover:brightness-110 transition"
               >
                 <Scale size={15} /> {tDynamic('Reposição de Cubas (Buffet)')}
               </button>
             )}
             {tab === 'insumos' && (
               <>
                 <button onClick={() => setInventarioAberto(true)}
                   className="flex items-center gap-1.5 rounded-xl border border-purple-200 px-3.5 py-1.5 text-xs font-bold text-purple-600 transition-colors hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-400 dark:hover:bg-purple-900/20">
                   <ClipboardCheck size={15} /> {tDynamic('Inventário')}
                 </button>
                 <button onClick={() => setTransformando(null)}
                   className="flex items-center gap-1.5 rounded-xl border border-orange-200 px-3.5 py-1.5 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-50 dark:border-orange-900/50 dark:text-orange-400 dark:hover:bg-orange-900/20">
                   <Scissors size={15} /> {tDynamic('Monta / Desmonta')}
                 </button>
               </>
             )}
         </div>
         <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shadow-inner">
           <button data-tour="tour-estoque-aba-insumos" onClick={() => setTab('insumos')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'insumos' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>{tDynamic('Matérias-Primas')}</button>
           <button data-tour="tour-estoque-aba-preparos" onClick={() => setTab('preparos')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'preparos' ? 'bg-white dark:bg-gray-900 shadow-sm text-orange-600 dark:text-orange-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>{tDynamic('Receitas & Preparos')}</button>
           <button data-tour="tour-estoque-aba-3d" onClick={() => setTab('custo3d')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'custo3d' ? 'bg-white dark:bg-gray-900 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>{tDynamic('Custo 3D')}</button>
           <button data-tour="tour-estoque-aba-rastreio3d" onClick={() => setTab('rastreio3d')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'rastreio3d' ? 'bg-white dark:bg-gray-900 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>{tDynamic('Rastreio 3D')}</button>
         </div>
      </div>

      {tab === 'rastreio3d' ? (
        <Suspense fallback={<div className="flex h-[560px] items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800/40"><MiseOnLoader status="Carregando Rastreio 3D..." rows={2} /></div>}>
          <EstoqueRastreio3D lojaId={lojaId} />
        </Suspense>
      ) : tab === 'custo3d' ? (
        <Suspense fallback={<div className="flex h-[520px] items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800/40"><MiseOnLoader status="Carregando Custo 3D..." rows={2} /></div>}>
          <EstoqueCusto3D lojaId={lojaId} />
        </Suspense>
      ) : tab === 'preparos' ? (
        <EstoquePreparos lojaId={lojaId} insumosTotais={[...insumos, ...inativos]} onUpdate={carregar} isBuffet={isBuffet} />
      ) : (
        <>
          {avisoEstoque && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <p className="flex items-start gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-400">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {avisoEstoque}
              </p>
              <button onClick={() => setAvisoEstoque(null)} className="shrink-0 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-500">Fechar</button>
            </div>
          )}

          {criticos.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:bg-amber-900/20 dark:border-amber-900/50 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
             <p className="flex items-center gap-1.5 text-sm font-bold text-amber-800 dark:text-amber-500 mb-1">
               <AlertTriangle size={16} /> Estoque Crítico Detetado
             </p>
             <p className="text-xs text-amber-700 dark:text-amber-400">Você tem {criticos.length} insumos que chegaram na margem de risco.</p>
          </div>
          <Link to="/admin/compras" className="shrink-0 flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-800 dark:hover:bg-amber-700 dark:text-amber-100 px-4 py-2 rounded-xl text-xs font-bold transition-colors">
            Ir para Central de Compras <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* BANNER DE IMPORTAÇÃO RÁPIDA NFC-E */}
      <div className="mb-6 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-4 text-white shadow-lg shadow-orange-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-black text-lg">
            <QrCode size={22} className="animate-bounce" /> {tDynamic('Importar Cupom de Mercado (NFC-e SP)')}
          </p>
          <p className="text-xs text-orange-100 mt-0.5">
            {tDynamic('Escaneie o QR Code do cupom fiscal e lance 15 compras de supermercado em menos de 5 segundos no estoque.')}
          </p>
        </div>
        <button
          onClick={() => setModalScannerAberto(true)}
          className="shrink-0 flex items-center gap-2 bg-white text-orange-600 hover:bg-orange-50 font-black text-sm px-5 py-3 rounded-xl shadow-md transition-all hover:scale-105"
        >
          <QrCode size={18} /> {tDynamic('Escanear Nota Fiscal')}
        </button>
      </div>

      {/* NOVO INSUMO COM MOTOR DINÂMICO */}
      <div id="form-novo-insumo" data-tour="tour-estoque-btn-novo-insumo" className={`mb-8 rounded-2xl ${editando ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 ring-2 ring-blue-500/20' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'} border p-5 shadow-sm transition-all duration-300`}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
           <div className="flex items-center gap-3">
             <p className="text-sm font-bold flex items-center gap-2 dark:text-gray-100">
               {editando ? <Pencil size={18} className="text-blue-500" /> : <Calculator size={18} className="text-[var(--cor-primaria)]" />} 
               {editando ? tDynamic('Editar Insumo') : tDynamic('Cadastrar Insumo')}
             </p>
             <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
               <button type="button" onClick={() => setModoCadastro('RAPIDO')}
                 className={`rounded px-3 py-1 text-xs font-bold transition-all ${modoCadastro === 'RAPIDO' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                 ⚡ {tDynamic('Rápido (Direto)')}
               </button>
               <button type="button" onClick={() => setModoCadastro('AVANCADO')}
                 className={`rounded px-3 py-1 text-xs font-bold transition-all ${modoCadastro === 'AVANCADO' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                 ⚙️ {tDynamic('Conversão de Embalagem')}
               </button>
             </div>
           </div>
           {editando && (
             <button onClick={cancelarEdicao} className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
               {tDynamic('Cancelar Edição')}
             </button>
           )}
        </div>
        
        <div className="space-y-5">
           {/* Linha 1: Dados básicos */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label data-tour="tour-estoque-campo-nome" className="block">
                 <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{tDynamic('Nome do Insumo / Produto')}</span>
                 <input id="input-nome-insumo" className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 focus:border-[var(--cor-primaria)] focus:outline-none transition-colors" placeholder={tDynamic('ex: Queijo Mussarela, Coca-Cola Lata')} value={nome} onChange={e => setNome(e.target.value)} />
              </label>
              <label className="block">
                 <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{tDynamic('Categoria')}</span>
                 <select className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 focus:border-[var(--cor-primaria)] focus:outline-none"
                   value={isNovaCategoria ? 'nova' : categoriaInsumo}
                   onChange={e => {
                     if (e.target.value === 'nova') {
                       setIsNovaCategoria(true);
                     } else {
                       setIsNovaCategoria(false);
                       setCategoriaInsumo(e.target.value);
                     }
                   }}>
                   {categoriasUnicas.map(cat => (
                     <option key={cat} value={cat}>{tDynamic(cat)}</option>
                   ))}
                   <option value="nova" className="font-bold text-orange-600">+ {tDynamic('Cadastrar Nova Categoria...')}</option>
                 </select>
                 {isNovaCategoria && (
                   <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                     <input className="w-full rounded-xl border border-orange-300 bg-orange-50/50 dark:bg-orange-900/10 p-3 text-sm dark:border-orange-800/50 dark:text-gray-100 focus:border-orange-500 focus:outline-none"
                       placeholder={tDynamic('Digite o nome da nova categoria...')}
                       value={nomeNovaCategoria}
                       onChange={e => setNomeNovaCategoria(e.target.value)}
                       autoFocus
                     />
                   </div>
                 )}
              </label>
              <label className="block">
                 <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{tDynamic('Setor de Armazenamento')}</span>
                 <select className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 focus:border-[var(--cor-primaria)] focus:outline-none"
                   value={setor}
                   onChange={e => setSetor(e.target.value)}>
                   {OPCOES_SETOR.map(op => (
                     <option key={op.valor} value={op.valor}>{tDynamic(op.rotulo)}</option>
                   ))}
                 </select>
                 <span className="mt-1 block text-[10px] text-gray-400 dark:text-gray-500">
                   {tDynamic('Onde o item fica guardado — usado no Rastreio 3D.')}
                 </span>
              </label>
           </div>
           
           {/* MODO RÁPIDO: Cadastro 1:1 Sem Complicação */}
           {modoCadastro === 'RAPIDO' ? (
             <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                 <label className="block">
                   <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Unidade de Estoque</span>
                   <select className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 font-bold outline-none focus:border-[var(--cor-primaria)]"
                     value={unidadeDireta} onChange={e => { setUnidadeDireta(e.target.value); setUnidadeCompra(e.target.value); }}>
                     {UNIDADES.map(u => (
                       <option key={u.codigo} value={u.codigo}>{u.rotulo}</option>
                     ))}
                   </select>
                 </label>

                 <label className="block">
                   <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Qtd em Estoque</span>
                   <div className="mt-1 flex rounded-lg border border-gray-300 overflow-hidden dark:border-gray-700 bg-white dark:bg-gray-950">
                     <input className="w-full p-2.5 text-sm font-bold dark:bg-gray-950 dark:text-gray-100 focus:outline-none bg-transparent" type="number" placeholder="0" value={qtdEstoqueCompra} onChange={e => setQtdEstoqueCompra(e.target.value)} />
                     <div className="bg-gray-100 dark:bg-gray-800 px-2 flex items-center justify-center text-[11px] text-gray-500 font-bold border-l border-gray-300 dark:border-gray-700 min-w-[2.5rem]">{unidadeDireta}</div>
                   </div>
                 </label>

                 <label className="block">
                   <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Preço pago (R$)</span>
                   <input className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm font-bold dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 focus:outline-none focus:border-[var(--cor-primaria)]" type="number" placeholder="0.00" value={precoCompra} onChange={e => setPrecoCompra(e.target.value)} />
                 </label>

                 <label className="block">
                   <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Alerta Estoque Mínimo</span>
                   <div className="mt-1 flex rounded-lg border border-gray-300 overflow-hidden dark:border-gray-700 bg-white dark:bg-gray-950">
                     <input className="w-full p-2.5 text-sm font-bold dark:bg-gray-950 dark:text-gray-100 focus:outline-none bg-transparent" type="number" placeholder="0" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} />
                     <div className="bg-gray-100 dark:bg-gray-800 px-2 flex items-center justify-center text-[11px] text-gray-500 font-bold border-l border-gray-300 dark:border-gray-700 min-w-[2.5rem]">{unidadeDireta}</div>
                   </div>
                 </label>
               </div>

               {Number(precoCompra) > 0 && Number(qtdEstoqueCompra) > 0 && (
                 <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold pt-2 border-t border-gray-200 dark:border-gray-800">
                   <span>Custo unitário calculado: {fmt(Number(precoCompra) / Number(qtdEstoqueCompra))} por {unidadeDireta}</span>
                   <span>Total em estoque: {fmt(Number(precoCompra))}</span>
                 </div>
               )}

               <button type="button" onClick={() => setModoCadastro('AVANCADO')} className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1">
                 ⚙️ Compras este item em Fardo/Caixa e usa em Gramas/Unidades? Clique para configurar conversão de embalagem
               </button>
             </div>
           ) : (
             /* MODO AVANÇADO: Conversão de Embalagens Multi-step */
             <>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Compra */}
                  <div data-tour="tour-estoque-campo-compra" className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700/50">
                     <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">1. Como você compra?</p>
                     <div className="space-y-3">
                        <label className="block">
                           <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Unidade de Compra</span>
                           <select className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none" value={unidadeCompra} onChange={e => setUnidadeCompra(e.target.value)}>
                             {UNIDADES.map(u => (
                               <option key={u.codigo} value={u.codigo}>{u.rotulo}</option>
                             ))}
                           </select>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                           <label className="block">
                              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Preço pago (R$)</span>
                              <input className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 focus:outline-none" type="number" placeholder="0.00" value={precoCompra} onChange={e => setPrecoCompra(e.target.value)} />
                           </label>
                           <label className="block">
                              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Qtd em Estoque</span>
                              <div className="mt-1 flex rounded-lg border border-gray-300 overflow-hidden dark:border-gray-600">
                                 <input className="w-full p-2 text-sm dark:bg-gray-900 dark:text-gray-100 focus:outline-none bg-transparent" type="number" placeholder="0" value={qtdEstoqueCompra} onChange={e => setQtdEstoqueCompra(e.target.value)} />
                                 <div className="bg-gray-100 dark:bg-gray-800 px-2 flex items-center justify-center text-[11px] text-gray-500 font-medium border-l border-gray-300 dark:border-gray-600 min-w-[3rem]">{unidadeCompra}</div>
                              </div>
                           </label>
                        </div>
                     </div>
                  </div>
                  
                  {/* Uso / Conversão */}
                  <div data-tour="tour-estoque-campo-conversao" className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                     <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-3 uppercase tracking-wider">2. COMO VOCÊ ARMAZENA / USA? (CONVERSÃO)</p>
                     <div className="space-y-3">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">Ex: Compro <b>Fardo</b> ➔ Rende 6 <b>Unidades</b>. Ou Compro <b>Caixa</b> ➔ Rende 20 <b>Kg</b>.</p>
                        {passosRendimento.map((passo, index) => {
                           const unidadeAnterior = index === 0 ? unidadeCompra : passosRendimento[index - 1].unidade;
                           const permitidos = destinosPermitidos(unidadeAnterior);
                           const validacao = validarConversao(
                              unidadeAnterior, passo.unidade, 1, Number(passo.rendimento) || 0,
                           );
                           return (
                              <div key={passo.id} className="relative p-3 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800/50 rounded-lg shadow-sm">
                                 <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-2">
                                    Passo {index + 1}: Essa compra de 1 {unidadeAnterior} rende...
                                 </span>
                                 <div className="flex gap-2 items-center">
                                    <input className={`w-20 rounded-lg border p-2 text-sm dark:bg-gray-950 dark:text-gray-100 focus:outline-none text-center ${validacao.ok ? 'border-blue-200 dark:border-blue-800/50' : 'border-red-400 dark:border-red-500/60'}`} type="number" min="0" max={validacao.rendimentoCanonico} value={passo.rendimento} onChange={e => {
                                       const newPassos = [...passosRendimento];
                                       newPassos[index].rendimento = e.target.value;
                                       setPassosRendimento(newPassos);
                                    }} />
                                    <select className="flex-1 rounded-lg border border-blue-200 p-2 text-sm dark:bg-gray-950 dark:border-blue-800/50 dark:text-gray-100 outline-none" value={passo.unidade} onChange={e => {
                                       const newPassos = [...passosRendimento];
                                       newPassos[index].unidade = e.target.value;
                                       setPassosRendimento(newPassos);
                                    }}>
                                      {permitidos.map(u => (
                                        <option key={u.codigo} value={u.codigo}>{u.rotulo}</option>
                                      ))}
                                    </select>
                                    {index > 0 && (
                                       <button onClick={() => setPassosRendimento(passosRendimento.filter(p => p.id !== passo.id))} className="p-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors">
                                          <Trash2 size={16} />
                                       </button>
                                    )}
                                 </div>
                                 {!validacao.ok && (
                                    <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                                       <AlertTriangle size={13} className="shrink-0 mt-px" />
                                       <span>{validacao.mensagem}</span>
                                    </p>
                                 )}
                                 {validacao.ok && validacao.rendimentoCanonico != null && (
                                    <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                                       1 {unidadeAnterior} = {validacao.rendimentoCanonico.toLocaleString('pt-BR')} {passo.unidade} (fator fixo).
                                    </p>
                                 )}
                              </div>
                           );
                        })}
                        
                        <button onClick={() => setPassosRendimento([...passosRendimento, { id: Math.random().toString(), rendimento: '1', unidade: 'un' }])} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline mt-1">
                           <Plus size={12} /> Adicionar quebra
                        </button>

                        <label data-tour="tour-estoque-campo-minimo" className="block mt-4 pt-3 border-t border-blue-200 dark:border-blue-800/30">
                           <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">Avisar estoque baixo quando chegar em:</span>
                           <div className="flex rounded-lg border border-blue-200 overflow-hidden dark:border-blue-800/50">
                              <input className="w-full p-2 text-sm dark:bg-gray-950 dark:text-gray-100 focus:outline-none bg-transparent" type="number" placeholder="0" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} />
                              <div className="bg-blue-100 dark:bg-blue-900/40 px-3 flex items-center justify-center text-[11px] text-blue-700 dark:text-blue-400 font-bold border-l border-blue-200 dark:border-blue-800/50 min-w-[3rem]">
                                 {passosRendimento[passosRendimento.length - 1].unidade}
                              </div>
                           </div>
                        </label>
                     </div>
                  </div>
               </div>

               <button type="button" onClick={() => setModoCadastro('RAPIDO')} className="text-[11px] text-gray-500 font-bold hover:underline flex items-center gap-1">
                 ⚡ Voltar para Cadastro Direto / Rápido
               </button>
             </>
           )}
           
           {/* Resumo */}
           {(Number(qtdEstoqueCompra) > 0 || Number(precoCompra) > 0) && (
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
                 <div>
                    <p className="text-[10px] text-green-700 dark:text-green-500 font-semibold uppercase">Estoque Final Calculado</p>
                    <p className="text-lg font-black text-green-800 dark:text-green-400">
                       {Number(qtdEstoqueCompra || 0) * (modoCadastro === 'RAPIDO' ? 1 : passosRendimento.reduce((acc, p) => acc * (Number(p.rendimento) || 1), 1))} {modoCadastro === 'RAPIDO' ? unidadeDireta : passosRendimento[passosRendimento.length - 1].unidade}
                    </p>
                 </div>
                 {Number(precoCompra) > 0 && (
                    <div className="text-right">
                       <p className="text-[10px] text-green-700 dark:text-green-500 font-semibold uppercase">Custo Unitário Final</p>
                       <p className="text-sm font-bold text-green-800 dark:text-green-400">
                          {fmt(Number(precoCompra) / (modoCadastro === 'RAPIDO' ? (Number(qtdEstoqueCompra) || 1) : passosRendimento.reduce((acc, p) => acc * (Number(p.rendimento) || 1), 1)))} por {modoCadastro === 'RAPIDO' ? unidadeDireta : passosRendimento[passosRendimento.length - 1].unidade}
                       </p>
                    </div>
                 )}
              </div>
           )}

           {/* Simulador de Custo e Visualizador de Caminho ao vivo (Só em modo avançado) */}
           {modoCadastro === 'AVANCADO' && (
             <div className="mt-4 space-y-4">
                <SimuladorCusto
                   item={itemVirtual}
                   unidadeOrigem={unidadeCompra}
                   custoEstimado={
                      Number(precoCompra) > 0 && passosRendimento.reduce((acc, p) => acc * (Number(p.rendimento) || 1), 1) > 0
                         ? Number(precoCompra) / passosRendimento.reduce((acc, p) => acc * (Number(p.rendimento) || 1), 1)
                         : undefined
                   }
                />
             </div>
           )}
        </div>
        
        <button onClick={criar} disabled={salvando || !nome.trim()}
          className={`mt-5 w-full flex items-center justify-center gap-1 rounded-xl py-3.5 text-sm font-bold text-white shadow-md hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed ${editando ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[var(--cor-primaria)]'}`}>
          {salvando ? (
            <span className="flex items-center gap-1.5"><Loader2 size={16} className="animate-spin" /> Salvando…</span>
          ) : editando ? (
            'Atualizar Insumo'
          ) : (
            <span className="flex items-center gap-1.5"><Plus size={16} /> Salvar Insumo</span>
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 mb-2">
         {/* Barra de Pesquisa */}
         <div className="relative flex-1 sm:max-w-md">
           <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
           <input 
             value={busca} 
             onChange={(e) => setBusca(e.target.value)} 
             placeholder="Buscar no estoque..."
             className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 shadow-sm transition-colors" 
           />
         </div>

         {/* Filtros de Categoria */}
         <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {['Tudo', ...categoriasUnicas].map(cat => (
              <button key={cat} onClick={() => setFiltroCategoria(cat === 'Tudo' ? null : cat)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-colors ${filtroCategoria === cat || (!filtroCategoria && cat === 'Tudo') ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 shadow-sm'}`}>
                {cat}
              </button>
            ))}
         </div>
      </div>

      <div className="mb-3 flex items-center gap-4 text-[11px] text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1.5"><Apple size={13} className="rounded-full bg-emerald-500 p-0.5 text-white" /> Nutrição revisada</span>
        <span className="flex items-center gap-1.5"><span className="relative inline-flex"><Apple size={13} className="text-emerald-500" /><span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" /></span> Aguardando revisão</span>
        <span className="flex items-center gap-1.5"><Apple size={13} className="text-emerald-500" /> Ainda não cadastrada</span>
      </div>

      <div className="space-y-3">
        {insumosBrutos.map((i) => {
          const custoUnit = Number(i.qtd_embalagem) > 0 ? Number(i.preco_embalagem) / Number(i.qtd_embalagem) : 0;
          const critico = Number(i.quantidade_atual) <= Number(i.estoque_minimo);
          return (
            <div key={i.id} className={`flex items-center justify-between rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm border ${critico ? 'border-amber-300 dark:border-amber-500/50' : 'border-gray-100 dark:border-gray-800'}`}>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  {i.nome} 
                  {i.categoria_insumo && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      i.categoria_insumo === 'Ingrediente' ? 'bg-orange-100/50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50' :
                      i.categoria_insumo === 'Revenda Direta' ? 'bg-blue-100/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' :
                      i.categoria_insumo === 'Embalagem' ? 'bg-purple-100/50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50' :
                      i.categoria_insumo === 'Limpeza' ? 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' :
                      'bg-gray-100/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700/50'
                    }`}>
                      {i.categoria_insumo}
                    </span>
                  )}
                  {(() => {
                    const setorEfetivo = validarSetor(i.setor) ?? derivarSetor(i.nome, i.categoria_insumo);
                    const s = SETORES[setorEfetivo];
                    return (
                      <span
                        title={i.setor ? `Setor: ${s.rotulo} (cadastro)` : `Setor: ${s.rotulo} (automático)`}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border"
                        style={{ color: s.cor, borderColor: `${s.cor}55`, backgroundColor: `${s.cor}1a` }}>
                        {s.icone} {s.rotulo}{i.setor ? '' : ' ·auto'}
                      </span>
                    );
                  })()}
                </p>
                <div className="flex gap-4 mt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Estoque: <span className="font-semibold text-gray-700 dark:text-gray-300">{Number(i.quantidade_atual)} {i.unidade_medida}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Custo Unitário: <span className="font-semibold text-[var(--cor-primaria)]">{fmt(custoUnit)}</span>
                  </p>
                </div>
                {((i.detalhes_rendimento?.regras?.length ?? 0) > 0 || (i.detalhes_rendimento?.equivalencias?.length ?? 0) > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(i.detalhes_rendimento?.regras ?? []).map((r: any, idx: number) => (
                      <span key={idx} className="text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                        {r.de_qtd} {r.de_unidade} ➔ {r.para_qtd} {r.para_unidade}
                      </span>
                    ))}
                    {/* Atalhos de entrada aprendidos: clicáveis porque um
                        rendimento digitado errado precisa ter volta. */}
                    {(i.detalhes_rendimento?.equivalencias ?? []).map((e) => (
                      <button key={e.unidade} onClick={() => removerEquivalencia(i, e.unidade)}
                        title="Remover essa conversão de entrada"
                        className="text-[9px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 px-1.5 py-0.5 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors">
                        entrada: 1 {e.unidade} ➔ {e.rende_qtd} {e.rende_unidade} ✕
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setRaioXInsumo(i)} className="rounded-lg p-2 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors" title="Raio-X (Análise de Lotes e Gráficos)">
                   <BarChart3 size={16} />
                </button>
                <button onClick={() => setTransformando(i)} className="rounded-lg p-2 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors" title="Desmontar em outros insumos (ex: peça em fatias)">
                   <Scissors size={16} />
                </button>
                {/* Álcool em gel, detergente, uniforme... não têm tabela nutricional —
                    só insumo que é comida (ou vira comida) mostra este botão. O
                    estado visual diz, sem abrir nada: pronto, pendente de revisão,
                    ou nunca tocado — a lacuna é sempre visível, nunca silenciosa. */}
                {ehTipoComNutricao(i.tipo_item) && (
                  <button onClick={() => setNutricaoInsumo(i)}
                    title={
                      statusNutricao[i.id] === 'completo' ? 'Nutrição revisada'
                      : statusNutricao[i.id] === 'pendente' ? 'Nutrição aguardando revisão'
                      : 'Nutrição ainda não cadastrada'
                    }
                    className={`relative rounded-lg p-2 border transition-colors ${
                      statusNutricao[i.id] === 'completo'
                        ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
                        : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                    }`}>
                     <Apple size={16} />
                     {statusNutricao[i.id] === 'pendente' && (
                       <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-gray-900" />
                     )}
                  </button>
                )}
                <button onClick={() => abrirEntrada(i)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-bold text-green-700 dark:text-green-400 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">+ Entrada</button>
                <div className="flex items-center border-l dark:border-gray-700 pl-2 ml-1 space-x-1">
                   <button onClick={() => iniciarEdicao(i)} className="rounded-lg p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Editar Insumo"><Pencil size={16} /></button>
                   <button onClick={() => toggleAtivo(i)} className="rounded-lg p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Excluir/Arquivar Insumo"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {inativosBrutos.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setMostrarInativos((v) => !v)} className="text-xs font-medium text-gray-400 underline">
            {mostrarInativos ? 'Ocultar' : 'Mostrar'} inativos ({inativosBrutos.length})
          </button>
          {mostrarInativos && (
            <div className="mt-2 space-y-2">
              {inativosBrutos.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-xl bg-white dark:bg-gray-900 p-3 opacity-60 shadow-sm border border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-medium dark:text-gray-100">{i.nome}</p>
                  <button onClick={() => toggleAtivo(i)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 dark:border-gray-700">
                    <ArchiveRestore size={13} /> Reativar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal entrada */}
      {entrada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setEntrada(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-gray-900 p-5 dark:border dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-gray-900 dark:text-gray-100 mb-4">Nova Entrada — {entrada.insumo.nome}</p>
            <div className="mb-3">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Quanto entrou?</span>
              <div className="flex gap-2">
                <input className="w-full min-w-0 rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number" min="0" step="any" autoFocus placeholder="0"
                  value={entrada.qtd} onChange={(e) => setEntrada({ ...entrada, qtd: e.target.value })} />
                <select className="shrink-0 rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                  value={entrada.unidade} onChange={(e) => setEntrada({ ...entrada, unidade: e.target.value, rendimentoNovo: '' })}>
                  <optgroup label="Do cadastro">
                    {opcoesEntrada.map(o => (
                      <option key={o.codigo} value={o.codigo}>{o.codigo}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Outra unidade (você informa o rendimento)">
                    {UNIDADES.filter(u => !opcoesEntrada.some(o => o.codigo === u.codigo)).map(u => (
                      <option key={u.codigo} value={u.codigo}>{u.codigo}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              {/* A conta na cara do lojista: ele digita na unidade que comprou,
                  mas o saldo continua sendo contado na unidade de uso. */}
              {opcaoEntrada && opcaoEntrada.fatorParaBase !== 1 && (
                <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {Number(entrada.qtd) > 0
                    ? <>Entra como <b className="text-green-700 dark:text-green-400">{qtdEntradaBase.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {entrada.insumo.unidade_medida}</b> no estoque.</>
                    : <>1 {opcaoEntrada.codigo} = {opcaoEntrada.fatorParaBase.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {entrada.insumo.unidade_medida}.</>}
                </p>
              )}
            </div>

            {/* Unidade que o cadastro não conhece: o lojista ensina o rendimento
                agora, em vez de ser obrigado a converter de cabeça. */}
            {unidadeAvulsa && (
              <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-900/10">
                <span className="mb-1.5 block text-xs font-medium text-blue-800 dark:text-blue-300">
                  Quanto rende 1 {entrada.unidade}?
                </span>
                <div className="flex items-center gap-2">
                  <input className="w-24 rounded-lg border border-blue-200 p-2 text-sm focus:outline-none dark:bg-gray-950 dark:border-blue-800/50 dark:text-gray-100" type="number" min="0" step="any" placeholder="0"
                    value={entrada.rendimentoNovo} onChange={(e) => setEntrada({ ...entrada, rendimentoNovo: e.target.value })} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{entrada.insumo.unidade_medida}</span>
                </div>
                {validacaoAvulsa && !validacaoAvulsa.ok && Number(entrada.rendimentoNovo) > 0 && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                    <AlertTriangle size={13} className="shrink-0 mt-px" />
                    <span>{validacaoAvulsa.mensagem}</span>
                  </p>
                )}
                {qtdEntradaBase > 0 && (
                  <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">
                    {entrada.qtd} {entrada.unidade} entram como{' '}
                    <b className="text-green-700 dark:text-green-400">{qtdEntradaBase.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {entrada.insumo.unidade_medida}</b>.
                  </p>
                )}
                <label className="mt-2.5 flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                  <input type="checkbox" className="accent-[var(--cor-primaria)]"
                    checked={entrada.lembrarConversao} onChange={(e) => setEntrada({ ...entrada, lembrarConversao: e.target.checked })} />
                  Guardar essa conversão no cadastro de {entrada.insumo.nome}
                </label>
              </div>
            )}
            <label className="block mb-3">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Custo da compra R$ (opcional)</span>
              <input className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number"
                value={entrada.custo} onChange={(e) => setEntrada({ ...entrada, custo: e.target.value })} />
              {Number(entrada.custo) > 0 && qtdEntradaBase > 0 && (
                <span className="mt-1.5 block text-[11px] text-gray-500 dark:text-gray-400">
                  Sai a {fmt(Number(entrada.custo) / qtdEntradaBase)} por {entrada.insumo.unidade_medida} nesta compra.
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
               <label className="block">
                 <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Lote (opcional)</span>
                 <input className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="text" placeholder="Ex: L1234"
                   value={entrada.lote || ''} onChange={(e) => setEntrada({ ...entrada, lote: e.target.value })} />
               </label>
               <label className="block">
                 <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Validade (opcional)</span>
                 <input className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="date"
                   value={entrada.validade || ''} onChange={(e) => setEntrada({ ...entrada, validade: e.target.value })} />
               </label>
            </div>
            <button onClick={registrarEntrada} disabled={!(qtdEntradaBase > 0)}
              className="mt-5 w-full rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              Registrar Estoque
            </button>
          </div>
        </div>
      )}

      {/* Modal Reposição de Cubas de Buffet */}
      {modalBuffetAberto && (
        <ModalReposicaoBuffet
          lojaId={lojaId}
          preparosAtivos={insumos.filter(i => i.is_preparo && i.ativo)}
          onSucesso={() => {
            setModalBuffetAberto(false);
            carregar();
          }}
          onCancelar={() => setModalBuffetAberto(false)}
        />
      )}
      {/* Modal Raio-X Individual */}
      {raioXInsumo && (
        <ModalRaioXProduto
          insumo={raioXInsumo}
          onClose={() => setRaioXInsumo(null)}
        />
      )}

      {nutricaoInsumo && (
        <ModalNutricaoInsumo
          insumo={nutricaoInsumo}
          lojaId={lojaId}
          onClose={() => setNutricaoInsumo(null)}
          onSalvo={carregar}
        />
      )}

      {inventarioAberto && (
        <ModalInventario
          insumos={insumos}
          onFechar={() => setInventarioAberto(false)}
          onSucesso={(msg) => { setInventarioAberto(false); setAvisoEstoque(msg); carregar(); }}
        />
      )}

      {transformando !== undefined && (
        <ModalTransformar
          lojaId={lojaId}
          insumos={insumos.filter(i => !i.is_preparo)}
          inicial={transformando}
          onFechar={() => setTransformando(undefined)}
          onSucesso={(msg) => { setTransformando(undefined); setAvisoEstoque(msg); carregar(); }}
        />
      )}

      {/* MODAL SCANNER DE QR CODE */}
      {modalScannerAberto && (
        <ScannerQRCodeModal
          onFechar={() => setModalScannerAberto(false)}
          onLido={processarQRCode}
          carregando={consultandoNota}
        />
      )}

      {/* MODAL DE CONFERÊNCIA DE IMPORTAÇÃO DA NFC-E */}
      {dadosNotaImportada && (
        <ModalImportarNFCe
          lojaId={lojaId}
          dadosNota={dadosNotaImportada}
          insumosExistentes={[...insumos, ...inativos]}
          onFechar={() => setDadosNotaImportada(null)}
          onSucesso={(msg) => {
            setDadosNotaImportada(null);
            setAvisoEstoque(msg);
            carregar();
          }}
        />
      )}
        </>
      )}
    </div>
  );
}

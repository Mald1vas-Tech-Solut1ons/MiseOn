import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChefHat, Flame, X, CheckCircle2, Clock, AlertTriangle, Timer, Copy, ArrowRight, PackageOpen, Sparkles, ArrowUp, ArrowDown, ListOrdered } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, PassoPreparo, ProducaoPreparo, fmt } from '../../types';
import { UNIDADES } from '../../lib/unidades';
import { podeEntrarNaFicha } from '../../lib/fichaTecnica';
import LinhaFichaInsumo from '../../components/producao/LinhaFichaInsumo';
import { LinhaFicha, linhaVazia, fatorParaEstoque } from '../../lib/producao/linhaFicha';
import { Tecnica, carregarTecnicas, HistoricoCoccao, buscarHistoricoCoccao } from '../../lib/producao/tecnicas';

import { useI18n } from '../../contexts/I18nContext';
/* ── Validade: status de um lote produzido ── */
function statusValidade(vence_em?: string | null): { label: string; classe: string; vencido: boolean } | null {
  if (!vence_em) return null;
  const restanteMs = new Date(vence_em).getTime() - Date.now();
  if (restanteMs <= 0) {
    return { label: 'VENCIDO', classe: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', vencido: true };
  }
  const horas = restanteMs / 3600e3;
  const label = horas < 1
    ? `vence em ${Math.max(1, Math.round(horas * 60))}min`
    : horas < 48
      ? `vence em ${Math.round(horas)}h`
      : `vence em ${Math.round(horas / 24)} dias`;
  const classe = horas <= 6
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  return { label, classe, vencido: false };
}

const dataHoraBr = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Roteiro do Modo de Preparo vindo do banco. É jsonb livre: qualquer coisa
 * fora do formato esperado vira lista vazia em vez de quebrar o editor.
 */
const lerPassos = (p: Insumo): { texto: string; minutos: string; fogo: boolean }[] => {
  const bruto = (p as { modo_preparo?: unknown }).modo_preparo;
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((item): item is PassoPreparo => !!item && typeof (item as PassoPreparo).texto === 'string')
    .map(item => ({
      texto: item.texto,
      minutos: Number(item.minutos) > 0 ? String(item.minutos) : '',
      fogo: item.fogo === true,
    }));
};

/**
 * Reconstrói as linhas da ficha preservando a intenção original do lojista:
 * ele digitou "5 un" e o banco guardou 0,6 kg de bruto. As duas coisas voltam.
 */
const lerLinhasFicha = (p: Insumo): LinhaFicha[] =>
  ((p as { fichas_preparos?: unknown }).fichas_preparos as Record<string, unknown>[] | undefined ?? [])
    .map(f => {
      const informada = Number(f.quantidade_informada);
      const unidade = typeof f.unidade_informada === 'string' ? f.unidade_informada : '';
      const pct = Number(f.rendimento_pct_aplicado);
      const origem = f.rendimento_origem as LinhaFicha['rendimento_origem'];
      return {
        insumo_id: String(f.insumo_id ?? ''),
        quantidade: String(informada > 0 ? informada : Number(f.quantidade ?? 0)),
        unidade,
        tecnica_codigo: typeof f.tecnica_codigo === 'string' ? f.tecnica_codigo : '',
        // Só volta como sobrescrita manual o que o usuário realmente digitou;
        // referência do sistema é recalculada, para acompanhar medições novas.
        rendimento_pct: origem === 'USUARIO' && pct > 0 ? String(Math.round(pct * 10000) / 100) : '',
        rendimento_origem: origem ?? null,
        rendimento_sistema_pct: origem && origem !== 'USUARIO' && pct > 0 ? pct : null,
      };
    });

/** Retorno de fn_produzir_preparo — o custo real apurado na produção. */
interface ResultadoProducao {
  preparo: string;
  quantidade: number;
  unidade: string;
  custo_total: number;
  custo_unitario: number;
  ingredientes: { insumo: string; quantidade: number; custo: number }[];
}

export default function EstoquePreparos({ lojaId, insumosTotais, onUpdate, isBuffet = false, somenteCadastro = false }: { lojaId: string; insumosTotais: Insumo[]; onUpdate: () => void; isBuffet?: boolean; somenteCadastro?: boolean }) {
  const { tDynamic } = useI18n();
  const [editando, setEditando] = useState<Insumo | 'novo' | null>(null);
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [rendimentoPorcoes, setRendimentoPorcoes] = useState('');
  const [rendimentoPadraoKg, setRendimentoPadraoKg] = useState('');
  const [validadeQtd, setValidadeQtd] = useState('');
  const [validadeUnidade, setValidadeUnidade] = useState<'horas' | 'dias' | 'semanas' | 'meses'>('dias');
  const [producoes, setProducoes] = useState<ProducaoPreparo[]>([]);
  const [ficha, setFicha] = useState<LinhaFicha[]>([]);
  const [tecnicas, setTecnicas] = useState<Tecnica[]>([]);
  const [historicoCoccao, setHistoricoCoccao] = useState<HistoricoCoccao | null>(null);
  const [passos, setPassos] = useState<{ texto: string; minutos: string; fogo: boolean }[]>([]);
  
  const [salvando, setSalvando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [avisoIA, setAvisoIA] = useState<string | null>(null);

  // Gamificação da Produção
  const [produzindo, setProduzindo] = useState<Insumo | null>(null);
  const [multProducao, setMultProducao] = useState(1);
  const [produzindoSucesso, setProduzindoSucesso] = useState(false);
  const [resultadoProducao, setResultadoProducao] = useState<ResultadoProducao | null>(null);

  const extrairValidadeDinamica = (h?: number | null) => {
    if (h == null || h <= 0) return { qtd: '', u: 'dias' as const };
    if (h % 720 === 0) return { qtd: String(h / 720), u: 'meses' as const };
    if (h % 168 === 0) return { qtd: String(h / 168), u: 'semanas' as const };
    if (h % 24 === 0) return { qtd: String(h / 24), u: 'dias' as const };
    return { qtd: String(h), u: 'horas' as const };
  };

  const calcularHorasValidade = (): number | null => {
    const q = Number(validadeQtd);
    if (!q || q <= 0) return null;
    if (validadeUnidade === 'meses') return q * 720;
    if (validadeUnidade === 'semanas') return q * 168;
    if (validadeUnidade === 'dias') return q * 24;
    return q;
  };

  const fmtValidadeExtensa = (h?: number | null) => {
    if (h == null || h <= 0) return '';
    if (h % 720 === 0) { const m = h / 720; return `${m} mes${m > 1 ? 'es' : 'ês'}`; }
    if (h % 168 === 0) { const s = h / 168; return `${s} sem`; }
    if (h % 24 === 0) { const d = h / 24; return `${d} dias`; }
    return `${h}h`;
  };

  const preparos = insumosTotais.filter(i => i.is_preparo && i.ativo);
  // Material de limpeza, higiene, EPI e manutencao nunca sao ingrediente:
  // a taxonomia de tipos_item ja diz isso, a tela so passou a respeitar.
  const insumosBrutos = insumosTotais.filter(i => !i.is_preparo && i.ativo && podeEntrarNaFicha(i));

  const carregarProducoes = useCallback(async () => {
    const { data } = await supabase
      .from('producoes_preparo')
      .select('*')
      .eq('loja_id', lojaId)
      .eq('status', 'ATIVO')
      .order('produzido_em', { ascending: false });
    setProducoes((data as ProducaoPreparo[]) ?? []);
  }, [lojaId]);

  useEffect(() => {
    if (!somenteCadastro) carregarProducoes();
  }, [carregarProducoes, somenteCadastro]);

  useEffect(() => { carregarTecnicas().then(setTecnicas); }, []);

  const descartarLote = async (lote: ProducaoPreparo) => {
    const preparo = insumosTotais.find(i => i.id === lote.preparo_id);
    if (!preparo) return;
    const qtdDescartar = Math.min(Number(lote.quantidade_produzida), Number(preparo.quantidade_atual));
    if (!confirm(`Descartar o lote de ${preparo.nome} produzido em ${dataHoraBr(lote.produzido_em)}?\n\nSerão baixados ${qtdDescartar} ${preparo.unidade_medida} do estoque como perda.`)) return;
    try {
      if (qtdDescartar > 0) {
        // Uma chamada transacional: a RPC grava a PERDA (custeada pelo PEPS
        // dos lotes, sinal negativo) e o saldo juntos (Sprint 1 — eram 2
        // chamadas soltas).
        const { error: movError } = await supabase.rpc('fn_movimentar_estoque', {
          p_insumo_id: lote.preparo_id,
          p_tipo: 'PERDA',
          p_quantidade: -qtdDescartar,
          p_motivo: `Descarte por validade — lote de ${dataHoraBr(lote.produzido_em)}`,
        });
        if (movError) throw movError;
      }
      await supabase.from('producoes_preparo').update({
        status: 'DESCARTADO',
        descartado_em: new Date().toISOString(),
        quantidade_descartada: qtdDescartar,
      }).eq('id', lote.id);
      carregarProducoes();
      onUpdate();
    } catch (e) {
      console.error(e);
      alert('Erro ao descartar o lote.');
    }
  };

  const iniciarEdicao = (p?: Insumo) => {
    if (p) {
      setEditando(p);
      setNome(p.nome);
      setUnidade(p.unidade_medida);
      setRendimentoPorcoes(String(p.rendimento_porcoes || ''));
      setRendimentoPadraoKg(String(p.rendimento_padrao_kg || ''));
      const v = extrairValidadeDinamica(p.validade_horas);
      setValidadeQtd(v.qtd);
      setValidadeUnidade(v.u);
      setFicha(lerLinhasFicha(p));
      setPassos(lerPassos(p));
      // O que a cozinha entregou nas ultimas producoes desta ficha. Serve para
      // o lojista descobrir que o rendimento que ele declarou e otimista.
      buscarHistoricoCoccao(p.id).then(setHistoricoCoccao);
    } else {
      setEditando('novo');
      setNome('');
      setUnidade('un');
      setRendimentoPorcoes('');
      setRendimentoPadraoKg('');
      setValidadeQtd('');
      setValidadeUnidade('dias');
      setFicha([]);
      setPassos([]);
      setHistoricoCoccao(null);
    }
  };

  const salvar = async () => {
    const rendimento = Number(rendimentoPorcoes);
    // Converte a intenção do usuário para a unidade de estoque: é nela que o
    // saldo vive e é ela que a RPC de produção consome.
    const linhasCalculadas = ficha
      .filter(f => f.insumo_id && Number(f.quantidade) > 0)
      .map(f => {
        const insumo = insumosTotais.find(i => i.id === f.insumo_id);
        const fator = fatorParaEstoque(insumo, f.unidade);
        const bruto = fator == null ? null : Number(f.quantidade) * fator;
        const pctManual = f.rendimento_pct === '' ? null : Number(f.rendimento_pct) / 100;
        return { linha: f, insumo, bruto, pctManual };
      });
    const semConversao = linhasCalculadas.find(l => l.bruto == null);
    if (semConversao) {
      return alert(`"${semConversao.insumo?.nome ?? 'Item'}" não tem conversão declarada de ${semConversao.linha.unidade} para ${semConversao.insumo?.unidade_medida}. Declare o rendimento no cadastro do insumo ou informe a quantidade na unidade do estoque.`);
    }
    const fichaValida = linhasCalculadas.filter(l => (l.bruto ?? 0) > 0);
    if (!nome.trim()) return alert('Dê um nome ao resultado da manipulação.');
    if (!(rendimento > 0)) return alert('Informe quanto um lote produz.');
    if (fichaValida.length === 0) return alert('Adicione ao menos uma matéria-prima com quantidade válida.');
    if (new Set(fichaValida.map(l => l.linha.insumo_id)).size !== fichaValida.length) return alert('A mesma matéria-prima aparece mais de uma vez. Agrupe a quantidade em uma única linha.');
    const passosValidos: PassoPreparo[] = passos
      .filter(p => p.texto.trim())
      .map(p => ({
        texto: p.texto.trim(),
        minutos: Number(p.minutos) > 0 ? Number(p.minutos) : null,
        fogo: p.fogo === true,
      }));
    setSalvando(true);
    try {
      let preparoId = editando !== 'novo' ? editando?.id : null;
      
      const payload = {
        loja_id: lojaId,
        nome,
        is_preparo: true,
        unidade_medida: unidade,
        rendimento_porcoes: rendimento,
        rendimento_padrao_kg: rendimentoPadraoKg !== '' ? Number(rendimentoPadraoKg) : null,
        validade_horas: calcularHorasValidade(),
        modo_preparo: passosValidos,
        ativo: true
      };

      if (preparoId) {
        const { error: erroPreparo } = await supabase.from('insumos').update(payload).eq('id', preparoId);
        if (erroPreparo) throw erroPreparo;
        const { error: erroLimparFicha } = await supabase.from('fichas_preparos').delete().eq('preparo_id', preparoId);
        if (erroLimparFicha) throw erroLimparFicha;
      } else {
        const { data, error: erroPreparo } = await supabase.from('insumos').insert({ ...payload, quantidade_atual: 0, estoque_minimo: 0, preco_embalagem: 0, qtd_embalagem: 1 }).select('id').single();
        if (erroPreparo) throw erroPreparo;
        preparoId = data?.id;
      }

      if (preparoId) {
        // `quantidade` é sempre o BRUTO na unidade de estoque; o líquido só é
        // gravado quando há técnica com rendimento, e o % vai congelado
        // (snapshot) para a auditoria não mudar sozinha depois.
        const linhas = fichaValida.map(({ linha, bruto, pctManual }) => {
          const pct = pctManual ?? linha.rendimento_sistema_pct ?? null;
          const usaPct = linha.tecnica_codigo && pct != null && pct > 0 && pct < 1;
          return {
            loja_id: lojaId,
            preparo_id: preparoId,
            insumo_id: linha.insumo_id,
            quantidade: bruto!,
            quantidade_liquida: usaPct ? Number((bruto! * pct!).toFixed(6)) : null,
            tecnica_codigo: linha.tecnica_codigo || null,
            rendimento_pct_aplicado: usaPct ? pct : null,
            rendimento_origem: usaPct ? (pctManual != null ? 'USUARIO' : linha.rendimento_origem) : null,
            quantidade_informada: Number(linha.quantidade),
            unidade_informada: linha.unidade || null,
          };
        });
        const { error: erroFicha } = await supabase.from('fichas_preparos').insert(linhas);
        if (erroFicha) throw erroFicha;
      }
      setEditando(null);
      onUpdate();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Erro ao salvar preparo.');
    }
    setSalvando(false);
  };

  const duplicarPreparo = (p: Insumo) => {
    setEditando('novo');
    setNome(`${p.nome} (Cópia)`);
    setUnidade(p.unidade_medida);
    setRendimentoPorcoes(String(p.rendimento_porcoes || ''));
    setRendimentoPadraoKg(String(p.rendimento_padrao_kg || ''));
    const v = extrairValidadeDinamica(p.validade_horas);
    setValidadeQtd(v.qtd);
    setValidadeUnidade(v.u);
    setFicha(lerLinhasFicha(p));
    setPassos(lerPassos(p));
  };

  const sugerirComIA = async () => {
    const primeiraLinha = ficha.find(f => f.insumo_id);
    if (!primeiraLinha) return alert('Escolha primeiro a matéria-prima que será manipulada.');
    setSugerindo(true);
    setAvisoIA(null);
    try {
      const { data, error } = await supabase.functions.invoke('preparo-sugerir', {
        body: { loja_id: lojaId, insumo_id: primeiraLinha.insumo_id, objetivo: nome.trim() || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.nome_resultado) setNome(String(data.nome_resultado));
      if (UNIDADES.some(u => u.codigo === data.unidade_resultado)) setUnidade(data.unidade_resultado);
      if (Number(data.quantidade_resultado) > 0) setRendimentoPorcoes(String(data.quantidade_resultado));
      if (Number(data.quantidade_consumida) > 0) {
        let aplicou = false;
        setFicha(atual => atual.map(f => {
          if (!aplicou && f.insumo_id === primeiraLinha.insumo_id) {
            aplicou = true;
            // A IA fala na unidade de estoque do insumo; a linha volta para ela
            // para o número não ser reinterpretado em outra unidade.
            const insumo = insumosTotais.find(i => i.id === f.insumo_id);
            return {
              ...f,
              quantidade: String(data.quantidade_consumida),
              unidade: insumo?.unidade_medida ?? f.unidade,
            };
          }
          return f;
        }));
      }
      if (Array.isArray(data.passos) && data.passos.length > 0) {
        setPassos(data.passos
          .filter((passo: { texto?: string }) => passo?.texto?.trim())
          .map((passo: { texto: string; minutos?: number | null; fogo?: boolean }) => ({
            texto: passo.texto.trim(),
            minutos: Number(passo.minutos) > 0 ? String(passo.minutos) : '',
            fogo: passo.fogo === true,
          })));
      }
      if (Number(data.validade_horas) > 0) {
        const validade = extrairValidadeDinamica(Number(data.validade_horas));
        setValidadeQtd(validade.qtd);
        setValidadeUnidade(validade.u);
      }
      setAvisoIA(data.justificativa || 'Sugestão aplicada como rascunho. Confira o rendimento real antes de salvar.');
    } catch (e) {
      console.error(e);
      setAvisoIA(e instanceof Error ? e.message : 'Não foi possível gerar a sugestão.');
    } finally {
      setSugerindo(false);
    }
  };

  const excluir = async (p: Insumo) => {
    if (confirm(`Excluir preparo ${p.nome}?`)) {
      await supabase.from('insumos').update({ ativo: false }).eq('id', p.id);
      onUpdate();
    }
  };

  const produzir = async () => {
    if (!produzindo || multProducao < 1) return;
    setSalvando(true);
    try {
      // Produção roda inteira no banco, numa transação só (fn_produzir_preparo).
      //
      // A versão anterior fazia isto em 5 chamadas soltas do navegador — baixa
      // ingredientes, atualiza saldos num laço, dá entrada, atualiza saldo,
      // grava a ordem. Duas consequências ruins:
      //   1. Não era atômica: queda de conexão no meio deixava o estoque
      //      inconsistente, com ingrediente baixado e preparo nunca criado.
      //   2. A entrada do preparo ia SEM custo, então ele passava a valer zero
      //      no estoque e todo prato feito com ele nascia barato — o X-PAULISTA
      //      aparecia a R$ 4,52 quando custa R$ 13,24.
      // Agora o banco consome os lotes pelo PEPS, soma o custo real dos
      // ingredientes e dá entrada no preparo já custeado.
      const { data, error } = await supabase.rpc('fn_produzir_preparo', {
        p_preparo_id: produzindo.id,
        p_multiplicador: multProducao,
      });
      if (error) throw error;

      setResultadoProducao(data as ResultadoProducao);
      carregarProducoes();

      setProduzindoSucesso(true);
      setTimeout(() => {
        setProduzindoSucesso(false);
        setProduzindo(null);
        setMultProducao(1);
        setResultadoProducao(null);
        onUpdate();
      }, 6000);
    } catch (e: any) {
      console.error(e);
      alert(`Erro na produção: ${e?.message ?? 'falha desconhecida'}`);
    }
    setSalvando(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 p-6 text-white shadow-xl shadow-orange-500/15 dark:border-orange-900/40">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center gap-4">
           <div className="rounded-2xl bg-white/15 p-4 shadow-inner backdrop-blur-sm">
             <ChefHat size={32} />
           </div>
           <div>
             <p className="mb-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-orange-100"><Sparkles size={13} /> {tDynamic('Engenharia de produção')}</p>
             <h2 className="text-2xl font-black">{tDynamic('Fichas & Manipulações')}</h2>
             <p className="mt-1 max-w-2xl text-sm font-medium text-orange-100">{tDynamic('Defina o que sai do estoque, como é transformado e o que a cozinha produz. Nenhum corte ou rendimento é presumido pelo sistema.')}</p>
           </div>
        </div>
      </div>

      {!editando && (
        <>
          <button type="button" onClick={() => iniciarEdicao()} className="group mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/70 py-4 font-black text-orange-700 transition-all hover:-translate-y-0.5 hover:border-orange-500 hover:bg-orange-100 hover:shadow-lg hover:shadow-orange-500/10 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-400 dark:hover:bg-orange-900/30">
            <span className="rounded-xl bg-orange-500 p-2 text-white transition-transform group-hover:rotate-6"><Plus size={18} /></span>
            {tDynamic('Criar nova manipulação ou receita base')}
          </button>

          <div className="space-y-4">
            {preparos.length === 0 && <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900"><PackageOpen size={38} className="mx-auto mb-3 text-orange-400" /><p className="font-black text-gray-700 dark:text-gray-200">{tDynamic('Sua bancada de produção está vazia')}</p><p className="mx-auto mt-1 max-w-md text-sm text-gray-400">{tDynamic('Exemplo: 1 kg de tomate entra, a equipe higieniza e fatia, e o rendimento real sai em porções, rodelas ou fatias.')}</p></div>}
            {preparos.map(p => {
               // Calculate custo da receita base
               const fichaP = (p as any).fichas_preparos || [];
               const custoReceita = fichaP.reduce((s: number, f: any) => {
                 const i = insumosTotais.find(x => x.id === f.insumo_id);
                 if (!i) return s;
                 const custoUnit = Number(i.qtd_embalagem) > 0 ? Number(i.preco_embalagem) / Number(i.qtd_embalagem) : 0;
                 return s + (custoUnit * Number(f.quantidade));
               }, 0);
               const rendimento = Number(p.rendimento_porcoes || 1);
               const custoPorcao = custoReceita / rendimento;
               const lotes = producoes.filter(l => l.preparo_id === p.id);
               const temVencido = lotes.some(l => statusValidade(l.vence_em)?.vencido);

               return (
                 <div key={p.id} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                   <div className="flex items-start justify-between">
                     <div>
                       <h3 className="text-lg font-black dark:text-gray-100 flex items-center gap-2">
                         {p.nome}
                         {p.validade_horas != null && Number(p.validade_horas) > 0 && (
                           <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs opacity-90 font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                             <Timer size={10} /> validade {fmtValidadeExtensa(p.validade_horas)}
                           </span>
                         )}
                         {temVencido && (
                           <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs opacity-90 font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                             <AlertTriangle size={10} /> lote vencido
                           </span>
                         )}
                       </h3>
                       <div className="flex gap-4 mt-2">
                         <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-100 dark:border-gray-700">
                           <p className="text-xs opacity-90 text-gray-500 uppercase font-bold">Estoque Atual</p>
                           <p className="font-black text-gray-900 dark:text-gray-100">{Number(p.quantidade_atual)} {p.unidade_medida}</p>
                         </div>
                         <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg px-3 py-1.5 border border-orange-100 dark:border-orange-900/30">
                           <p className="text-xs opacity-90 text-orange-600 dark:text-orange-500 uppercase font-bold">Custo P/ {p.unidade_medida}</p>
                           <p className="font-black text-orange-700 dark:text-orange-400">{fmt(custoPorcao)}</p>
                         </div>
                       </div>
                     </div>
                     <div className="flex items-center gap-2">
                       {!somenteCadastro && <button type="button" onClick={() => setProduzindo(p)} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md shadow-orange-500/20 transition-all hover:scale-105">
                         <Flame size={16} /> Produzir
                       </button>}
                       <div className="flex flex-col gap-1 border-l pl-2 dark:border-gray-800">
                         <button type="button" onClick={() => iniciarEdicao(p)} title="Editar receita" className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"><Pencil size={15} /></button>
                         <button type="button" onClick={() => duplicarPreparo(p)} title="Duplicar receita (clonar)" className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20"><Copy size={15} /></button>
                         <button type="button" onClick={() => excluir(p)} title="Excluir receita" className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={15} /></button>
                       </div>
                     </div>
                   </div>

                   {/* ── Lotes produzidos (ordens de serviço) ── */}
                   {!somenteCadastro && lotes.length > 0 && (
                     <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
                       <p className="mb-2 flex items-center gap-1.5 text-xs opacity-90 font-black uppercase tracking-wider text-gray-400"><Clock size={11} /> Lotes em uso</p>
                       <div className="space-y-1.5">
                         {lotes.map(l => {
                           const st = statusValidade(l.vence_em);
                           return (
                             <div key={l.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs ${st?.vencido ? 'bg-red-50 dark:bg-red-900/10' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                               <div className="min-w-0">
                                 <span className="font-bold dark:text-gray-200">{Number(l.quantidade_produzida)} {p.unidade_medida}</span>
                                 <span className="text-gray-400"> · {l.lotes} lote(s) · produzido {dataHoraBr(l.produzido_em)}</span>
                               </div>
                               <div className="flex shrink-0 items-center gap-1.5">
                                 {st
                                   ? <span className={`rounded-full px-2 py-0.5 text-xs opacity-90 font-bold ${st.classe}`}>{st.label}</span>
                                   : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs opacity-90 font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">sem validade</span>}
                                 <button type="button" onClick={() => descartarLote(l)} title="Descartar lote (baixa como perda)" className="rounded-lg p-1 text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30">
                                   <Trash2 size={13} />
                                 </button>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   )}
                 </div>
               );
            })}
          </div>
        </>
      )}

      {/* MODAL DE EDIÇÃO DE PREPARO */}
      {editando && (() => {
        // O custo conta o BRUTO: a loja pagou pela casca, pelo osso e pela
        // apara. Contar o líquido aqui subestimaria o CMV.
        const custoFichaTotal = ficha.reduce((acc, f) => {
          const ing = insumosTotais.find(x => x.id === f.insumo_id);
          if (!ing) return acc;
          const fator = fatorParaEstoque(ing, f.unidade);
          if (fator == null) return acc;
          const unit = Number(ing.qtd_embalagem) > 0 ? Number(ing.preco_embalagem) / Number(ing.qtd_embalagem) : 0;
          return acc + (unit * Number(f.quantidade || 0) * fator);
        }, 0);
        const rend = Number(rendimentoPorcoes) || 1;
        const custoPorUnidade = custoFichaTotal / rend;

        return (
          <div className="relative overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-xl shadow-orange-500/10 dark:border-orange-900/40 dark:bg-gray-900">
            <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-5 dark:border-orange-900/30 dark:from-orange-950/30 dark:to-gray-900">
            <button type="button" onClick={() => setEditando(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">{tDynamic('Origem → processo → resultado')}</p>
            <h3 className="mt-1 text-xl font-black text-gray-900 dark:text-gray-100">{editando === 'novo' ? 'Nova ficha de manipulação' : 'Editar ficha de produção'}</h3>
            <p className="mt-1 text-sm text-gray-500">{tDynamic('Você define o rendimento. O MiseOn conserva custo e rastreabilidade entre a matéria-prima e o item produzido.')}</p>
            </div>
            
            <div className="space-y-5 p-6">
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white">1</span><div><h4 className="font-black text-emerald-900 dark:text-emerald-300">{tDynamic('O que entra pronto no estoque?')}</h4><p className="text-xs text-emerald-700/75 dark:text-emerald-500/80">{tDynamic('Nome e rendimento final de um lote.')}</p></div></div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400">{tDynamic('Nome do Preparo')}</label>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="ex: Tomate higienizado e fatiado" className="mt-1 w-full rounded-xl border border-emerald-200 bg-white p-3 font-bold outline-none focus:border-emerald-500 dark:border-emerald-900/50 dark:bg-gray-950 dark:text-gray-100" />

              <div className={`mt-3 grid grid-cols-2 ${isBuffet ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
                <div>
                  <label className="text-xs opacity-90 uppercase font-bold text-gray-500 dark:text-gray-400">{tDynamic('Quantidade produzida')}</label>
                  <input value={rendimentoPorcoes} onChange={e => setRendimentoPorcoes(e.target.value)} type="number" min="0" step="any" placeholder="ex: 20" className="mt-1 w-full p-2.5 rounded-xl border border-emerald-200 bg-white dark:border-emerald-900/50 dark:bg-gray-950 dark:text-gray-100 outline-none focus:border-emerald-500 text-center font-bold text-lg" />
                </div>
                <div>
                  <label className="text-xs opacity-90 uppercase font-bold text-gray-500 dark:text-gray-400">{tDynamic('Unidade do resultado')}</label>
                  <select value={unidade} onChange={e => setUnidade(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-emerald-200 bg-white dark:border-emerald-900/50 dark:bg-gray-950 dark:text-gray-100 outline-none focus:border-emerald-500 text-center font-bold">
                    {UNIDADES.filter(u => u.grandeza !== 'agrupador').map(u => <option key={u.codigo} value={u.codigo}>{u.rotulo}</option>)}
                  </select>
                </div>
                {isBuffet && (
                  <div>
                    <label className="text-xs opacity-90 uppercase font-bold text-gray-500 dark:text-gray-400">Rendimento Kg (Buffet)</label>
                    <input value={rendimentoPadraoKg} onChange={e => setRendimentoPadraoKg(e.target.value)} type="number" step="0.001" placeholder="ex: 2.500" className="mt-1 w-full p-2.5 rounded-xl border border-orange-300 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/10 text-orange-900 dark:text-orange-100 outline-none focus:border-orange-500 text-center font-bold text-lg" />
                  </div>
                )}
              </div>
              {historicoCoccao && historicoCoccao.media_pct != null && (
                <div className={`mt-3 rounded-xl border p-3 ${
                  Math.abs(historicoCoccao.media_pct - 1) < 0.05
                    ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                    : 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                }`}>
                  <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-gray-500">
                    <Flame size={12} className="text-orange-500" /> {tDynamic('O que a sua cozinha entrega')}
                  </p>
                  <p className="mt-1 text-sm font-bold text-gray-700 dark:text-gray-200">
                    {tDynamic('Nas últimas')} {historicoCoccao.producoes} {historicoCoccao.producoes === 1 ? tDynamic('produção') : tDynamic('produções')},{' '}
                    {tDynamic('este lote rendeu em média')}{' '}
                    <span className={Math.abs(historicoCoccao.media_pct - 1) < 0.05 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                      {(historicoCoccao.media_pct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                    </span>{' '}
                    {tDynamic('do previsto')}
                    {historicoCoccao.menor_pct != null && historicoCoccao.maior_pct != null
                      && historicoCoccao.maior_pct - historicoCoccao.menor_pct > 0.05 && (
                      <span className="font-medium text-gray-400">
                        {' '}({(historicoCoccao.menor_pct * 100).toFixed(0)}% a {(historicoCoccao.maior_pct * 100).toFixed(0)}%)
                      </span>
                    )}.
                  </p>
                  {historicoCoccao.media_pct < 0.95 && (
                    <p className="mt-1 text-xs leading-snug text-amber-700/90 dark:text-amber-500/90">
                      {tDynamic('A cocção está concentrando mais do que a ficha prevê. Ajustar a quantidade produzida para o número real deixa o custo por unidade e a compra corretos.')}
                    </p>
                  )}
                </div>
              )}
              </section>

              <div className="flex items-center justify-center gap-3 text-gray-300 dark:text-gray-700"><div className="h-px flex-1 bg-current"/><ArrowRight size={20} className="text-orange-400"/><div className="h-px flex-1 bg-current"/></div>

              <section className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900/40 dark:bg-orange-950/10">
                <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white">2</span><div><h4 className="font-black text-orange-900 dark:text-orange-300">{tDynamic('O que será consumido?')}</h4><p className="text-xs text-orange-700/75 dark:text-orange-500/80">{tDynamic('Matérias-primas e quantidades reais para produzir um lote.')}</p></div></div>
                <div className="space-y-2">
                  {ficha.map((f, i) => (
                    <LinhaFichaInsumo
                      key={i}
                      indice={i}
                      linha={f}
                      insumos={insumosBrutos}
                      jaUsados={ficha.map(l => l.insumo_id)}
                      tecnicas={tecnicas}
                      onChange={linha => { const n = [...ficha]; n[i] = linha; setFicha(n); }}
                      onRemover={() => { const n = [...ficha]; n.splice(i, 1); setFicha(n); }}
                    />
                  ))}
                  <button type="button" onClick={() => setFicha([...ficha, linhaVazia()])} className="mt-2 flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400"><Plus size={14}/> {tDynamic('Adicionar matéria-prima')}</button>
                </div>
                <div className="mt-4 border-t border-orange-200/70 pt-4 dark:border-orange-900/40">
                  <button type="button" onClick={sugerirComIA} disabled={sugerindo} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50 dark:bg-white dark:text-slate-950">
                    <Sparkles size={16} className={sugerindo ? 'animate-pulse' : 'text-orange-400'} /> {sugerindo ? 'Consultando chef inteligente…' : 'Sugerir transformação com IA'}
                  </button>
                  <p className="mt-2 text-center text-xs text-gray-400">{tDynamic('A IA cria apenas um rascunho. Você confirma rendimento, perda e validade.')}</p>
                  {avisoIA && <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-medium leading-relaxed text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">{avisoIA}</p>}
                </div>
              </section>

              <div className="flex items-center justify-center gap-3 text-gray-300 dark:text-gray-700"><div className="h-px flex-1 bg-current"/><ArrowRight size={20} className="text-amber-400"/><div className="h-px flex-1 bg-current"/></div>

              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
                <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white">3</span><div><h4 className="font-black text-amber-900 dark:text-amber-300">{tDynamic('Como o lote será controlado?')}</h4><p className="text-xs text-amber-700/75 dark:text-amber-500/80">{tDynamic('Validade é definida pela operação, nunca pelo sistema.')}</p></div></div>
                <label className="flex items-center gap-1.5 text-xs opacity-90 uppercase font-bold text-amber-700 dark:text-amber-500"><Timer size={13} /> {tDynamic('Validade após produção')}</label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <input value={validadeQtd} onChange={e => setValidadeQtd(e.target.value)} type="number" min="0" placeholder="ex: 3" className="w-24 p-2.5 rounded-xl border border-amber-300 dark:border-amber-900/50 bg-white dark:bg-gray-950 dark:text-gray-100 outline-none focus:border-amber-500 text-center font-bold text-lg" />
                    <select value={validadeUnidade} onChange={e => setValidadeUnidade(e.target.value as any)} className="p-2.5 rounded-xl border border-amber-300 dark:border-amber-900/50 bg-white dark:bg-gray-950 dark:text-gray-100 outline-none focus:border-amber-500 font-bold text-sm">
                      <option value="horas">Horas</option>
                      <option value="dias">Dias</option>
                      <option value="semanas">Semanas</option>
                      <option value="meses">Meses</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { q: '24', u: 'horas', l: '24 horas' },
                      { q: '3', u: 'dias', l: '3 dias' },
                      { q: '1', u: 'semanas', l: '1 semana' },
                      { q: '1', u: 'meses', l: '1 mês' },
                      { q: '3', u: 'meses', l: '3 meses' },
                    ].map(o => (
                      <button key={o.l} type="button" onClick={() => { setValidadeQtd(o.q); setValidadeUnidade(o.u as any); }} className={`rounded-full border px-3 py-1 text-xs font-bold transition ${validadeQtd === o.q && validadeUnidade === o.u ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-300 text-amber-700 dark:border-amber-900/50 dark:text-amber-500'}`}>{o.l}</button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs opacity-95 text-amber-700/80 dark:text-amber-500/80">{tDynamic('Cada produção vira uma ordem de serviço com data de vencimento. Deixe em branco para não controlar validade.')}</p>
              </section>

              <div className="flex items-center justify-center gap-3 text-gray-300 dark:text-gray-700"><div className="h-px flex-1 bg-current"/><ArrowRight size={20} className="text-blue-400"/><div className="h-px flex-1 bg-current"/></div>

              <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/10">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-white">4</span>
                  <div>
                    <h4 className="flex items-center gap-1.5 font-black text-blue-900 dark:text-blue-300"><ListOrdered size={15} /> {tDynamic('Modo de preparo')}</h4>
                    <p className="text-xs text-blue-700/75 dark:text-blue-500/80">{tDynamic('O roteiro que a cozinha vai seguir passo a passo, com tempo cronometrado.')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {passos.map((passo, i) => (
                    <div key={i} className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm dark:border-blue-900/40 dark:bg-gray-950">
                      <div className="flex items-start gap-2">
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{i + 1}</span>
                        <textarea
                          value={passo.texto}
                          onChange={e => { const n = [...passos]; n[i].texto = e.target.value; setPassos(n); }}
                          rows={2}
                          placeholder={tDynamic('ex: Higienizar em solução clorada e escorrer bem')}
                          className="min-w-0 flex-1 resize-y rounded-lg border border-gray-200 bg-transparent p-2 text-sm font-medium outline-none focus:border-blue-500 dark:border-gray-800 dark:text-gray-100"
                        />
                        <div className="flex shrink-0 flex-col gap-1">
                          <button type="button" onClick={() => { if (i === 0) return; const n = [...passos]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setPassos(n); }} disabled={i === 0} title={tDynamic('Subir')} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 dark:hover:bg-blue-900/20"><ArrowUp size={14} /></button>
                          <button type="button" onClick={() => { if (i === passos.length - 1) return; const n = [...passos]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setPassos(n); }} disabled={i === passos.length - 1} title={tDynamic('Descer')} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 dark:hover:bg-blue-900/20"><ArrowDown size={14} /></button>
                          <button type="button" onClick={() => { const n = [...passos]; n.splice(i, 1); setPassos(n); }} title={tDynamic('Remover etapa')} className="rounded-lg bg-red-50 p-1.5 text-red-400 hover:text-red-600 dark:bg-red-900/20"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 pl-9">
                        <Timer size={13} className="text-blue-400" />
                        <input
                          value={passo.minutos}
                          onChange={e => { const n = [...passos]; n[i].minutos = e.target.value; setPassos(n); }}
                          type="number" min="0" step="any" placeholder="—"
                          className="w-20 rounded-lg border border-gray-200 bg-transparent p-1.5 text-center text-sm font-bold outline-none focus:border-blue-500 dark:border-gray-800 dark:text-gray-100"
                        />
                        <span className="text-xs font-semibold text-gray-400">{tDynamic('minutos')}</span>
                        <button
                          type="button"
                          onClick={() => { const n = [...passos]; n[i].fogo = !n[i].fogo; setPassos(n); }}
                          title={tDynamic('Marque quando a etapa fica com chama ou forno ligado — é o que vira custo de gás.')}
                          className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-all ${
                            passo.fogo
                              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Flame size={13} /> {tDynamic('Fogo/forno')}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setPassos([...passos, { texto: '', minutos: '', fogo: false }])} className="mt-2 flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"><Plus size={14}/> {tDynamic('Adicionar etapa')}</button>
                </div>

                {passos.length === 0 && (
                  <p className="mt-3 rounded-xl border border-dashed border-blue-200 p-3 text-center text-xs font-medium text-blue-700/70 dark:border-blue-900/40 dark:text-blue-400/70">
                    {tDynamic('Sem roteiro, a OS roda só com a conferência da mise en place. Com roteiro, a equipe executa em tela cheia, um passo por vez.')}
                  </p>
                )}
              </section>

              {/* PAINEL DE CUSTO ESTIMADO EM TEMPO REAL */}
              {custoFichaTotal > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs opacity-90 font-black uppercase text-emerald-800 dark:text-emerald-400">{tDynamic('Custo Estimado do Lote')}</p>
                      <p className="text-xl font-black text-emerald-900 dark:text-emerald-100">{fmt(custoFichaTotal)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-90 font-black uppercase text-emerald-800 dark:text-emerald-400">Custo Estimado P/ {unidade}</p>
                      <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{fmt(custoPorUnidade)}</p>
                    </div>
                  </div>
                </div>
              )}

              <button type="button" onClick={salvar} disabled={salvando} className="w-full mt-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black rounded-2xl py-4 shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar ficha de produção'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* GAMIFICADA: BORA COZINHAR */}
      {produzindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => !salvando && setProduzindo(null)}>
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl p-8 relative overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* Background blur color */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-orange-500/20 to-transparent pointer-events-none" />
            
            {produzindoSucesso ? (
               <div className="text-center py-6 animate-in zoom-in duration-300">
                  <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3 text-green-500">
                    <CheckCircle2 size={34} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">Pronto!</h3>

                  {resultadoProducao ? (
                    <>
                      {/* O custo apurado na hora: é o número que o dono usa para
                          precificar. Antes o preparo entrava valendo zero e ele
                          nunca via quanto a panela custou de verdade. */}
                      <p className="text-gray-500 mt-1 text-sm font-medium">
                        {fmt(resultadoProducao.quantidade)} {resultadoProducao.unidade} de {resultadoProducao.preparo} no estoque.
                      </p>

                      <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-left dark:border-green-900/40 dark:bg-green-900/10">
                        <p className="text-xs opacity-90 font-black uppercase tracking-wider text-green-800 dark:text-green-400">
                          {tDynamic('Custo apurado desta produção')}
                        </p>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{tDynamic('Total da panela')}</span>
                          <span className="text-xl font-black text-gray-900 dark:text-gray-100">
                            R$ {fmt(resultadoProducao.custo_total)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between border-t border-green-200/70 pt-2 dark:border-green-900/40">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Custo por {resultadoProducao.unidade}
                          </span>
                          <span className="text-lg font-black text-green-700 dark:text-green-400">
                            R$ {fmt(resultadoProducao.custo_unitario)}
                          </span>
                        </div>

                        {resultadoProducao.ingredientes?.length > 0 && (
                          <ul className="mt-3 space-y-1 border-t border-green-200/70 pt-2 dark:border-green-900/40">
                            {resultadoProducao.ingredientes.map((ing, idx) => (
                              <li key={idx} className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                                <span>{ing.insumo}</span>
                                <span className="font-semibold">R$ {fmt(ing.custo)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <p className="mt-3 text-xs opacity-95 leading-relaxed text-gray-400">
                        {tDynamic('Esse custo já entra nas fichas técnicas dos pratos que usam este preparo.')}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-500 mt-2 font-medium">
                      Os insumos foram debitados e o lote de {produzindo.nome} foi adicionado ao estoque.
                    </p>
                  )}
               </div>
            ) : (
               <>
                  <div className="flex justify-center mb-4 relative z-10">
                    <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 p-4 rounded-full shadow-inner">
                      <Flame size={32} />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-black text-center text-gray-900 dark:text-gray-100 mb-2">Bora Cozinhar!</h3>
                  <p className="text-center text-gray-500 text-sm font-medium mb-6">{tDynamic('Quantas receitas de')} <b className="text-orange-600">{produzindo.nome}</b> você vai fazer agora?</p>

                  <div className="flex items-center justify-center gap-6 mb-8">
                     <button type="button" onClick={() => setMultProducao(m => Math.max(1, m - 1))} className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-black text-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">-</button>
                     <div className="text-center w-24">
                       <span className="text-5xl font-black text-orange-600 dark:text-orange-500">{multProducao}x</span>
                       <span className="block text-xs opacity-90 uppercase font-bold text-gray-400 mt-1">Lotes</span>
                     </div>
                     <button type="button" onClick={() => setMultProducao(m => m + 1)} className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-black text-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">+</button>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/10 rounded-2xl p-4 border border-orange-100 dark:border-orange-900/30 mb-6 max-h-32 overflow-y-auto">
                    <p className="text-xs opacity-90 uppercase font-black text-orange-800 dark:text-orange-400 mb-2">{tDynamic('Resumo da Produção:')}</p>
                    <ul className="space-y-1.5">
                       {((produzindo as any).fichas_preparos || []).map((f: any, idx: number) => {
                          const i = insumosTotais.find(x => x.id === f.insumo_id);
                          return (
                            <li key={idx} className="flex justify-between text-sm font-medium">
                              <span className="text-gray-600 dark:text-gray-400 line-through decoration-red-500/50 decoration-2">{i?.nome}</span>
                              <span className="text-red-500 font-bold">-{Number(f.quantidade) * multProducao} {i?.unidade_medida}</span>
                            </li>
                          );
                       })}
                    </ul>
                    <div className="mt-3 pt-3 border-t border-orange-200/50 flex justify-between text-sm font-black">
                       <span className="text-orange-800 dark:text-orange-400">Rendimento Final:</span>
                       <span className="text-green-600">+{Number(produzindo.rendimento_porcoes || 1) * multProducao} {produzindo.unidade_medida}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                     <button type="button" onClick={() => setProduzindo(null)} className="flex-1 py-4 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancelar</button>
                     <button type="button" onClick={produzir} disabled={salvando} className="flex-1 py-4 font-black text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg shadow-orange-500/30 hover:scale-105 transition-all disabled:opacity-50">
                       {salvando ? 'Debitando...' : 'Panela no Fogo!'}
                     </button>
                  </div>
               </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

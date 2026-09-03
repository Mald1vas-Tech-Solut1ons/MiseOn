import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Apple, AlertCircle, CheckCircle2, Info, Barcode, Camera, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, InsumoNutricao } from '../../types';
import { getUnidade } from '../../lib/unidades';
import MiseOnLoader from '../MiseOnLoader';

import { useI18n } from '../../contexts/I18nContext';
/**
 * `supabase.functions.invoke` engole o corpo da resposta em erros não-2xx —
 * o motivo real (ex.: "Gemini: model not found") fica em `error.context`,
 * a Response crua. Sem isto, todo erro de function vira um genérico inútil.
 */
async function motivoReal(error: unknown, generico: string): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const corpo = await ctx.clone().json();
      if (corpo?.error) return corpo.error;
    } catch { /* corpo não era JSON — usa o genérico */ }
  }
  return generico;
}

// alimentos_referencia.fonte ('USDA_FDC', 'TBCA', ...) → insumos_nutricao.origem
// (só aceita 'USDA'|'TBCA'|...). Sem este de-para, salvar quebra a constraint.
const FONTE_PARA_ORIGEM: Record<string, InsumoNutricao['origem']> = {
  USDA_FDC: 'USDA',
  TBCA: 'TBCA',
  IBGE_POF: 'USDA', // sem código próprio ainda; mais perto de base científica genérica
  ROTULO_FABRICANTE: 'ROTULO_EAN',
};

// Rótulo curto e sem jargão de enum interno, pra exibir ao lojista.
const ROTULO_FONTE: Record<string, string> = {
  USDA_FDC: 'USDA', TBCA: 'TBCA', IBGE_POF: 'IBGE/POF', ROTULO_FABRICANTE: 'rótulo do fabricante',
};

/**
 * Redimensiona para no máximo 1600px no maior lado e recomprime em JPEG.
 * Foto de câmera de celular vem com 8-12 MB — sem isso, o upload falha ou
 * fica lento, e o custo por chamada de OCR sobe à toa (ADR-04, §5.1 ②).
 */
async function comprimirImagem(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, largura, altura);

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85),
  );
  const base64 = await new Promise<string>((resolve) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve((leitor.result as string).split(',')[1]);
    leitor.readAsDataURL(blob);
  });
  return { base64, mimeType: 'image/jpeg' };
}

interface Props {
  insumo: Insumo;
  lojaId: string;
  onClose: () => void;
  onSalvo?: () => void;
}

interface NutrienteCatalogo {
  codigo: string;
  rotulo: string;
  abreviacao: string | null;
  unidade: string;
  ordem: number;
  indentacao: number;
}

// RDC 26/2015 — os alérgenos de declaração obrigatória no Brasil.
const ALERGENOS = [
  'Trigo/Glúten', 'Centeio', 'Cevada', 'Aveia',
  'Crustáceos', 'Ovos', 'Peixes', 'Amendoim', 'Soja',
  'Leite', 'Castanhas/Nozes', 'Látex natural',
] as const;

/**
 * NUT-08 (cadastro manual) + NUT-10/11 (confirmação de EAN e foto de rótulo).
 * As três formas de captura convergem neste único formulário: buscar por
 * código de barras ou fotografar o rótulo só PRÉ-PREENCHE os campos — a
 * gravação com revisado=true só acontece quando o lojista clica Salvar
 * (ADR-02: IA e lookup externo capturam, humano publica).
 */
export default function ModalNutricaoInsumo({ insumo, lojaId, onClose, onSalvo }: Props) {
  const { tDynamic } = useI18n();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [catalogo, setCatalogo] = useState<NutrienteCatalogo[]>([]);

  const [baseUnidade, setBaseUnidade] = useState<'g' | 'ml'>('g');
  const [pesoMedioUnG, setPesoMedioUnG] = useState('');
  const [densidadeGMl, setDensidadeGMl] = useState('');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [contem, setContem] = useState<Set<string>>(new Set());
  const [podeConter, setPodeConter] = useState<Set<string>>(new Set());

  const [origemAtual, setOrigemAtual] = useState<InsumoNutricao['origem'] | null>(null);
  const [revisadoAtual, setRevisadoAtual] = useState(false);
  const [fonteRef, setFonteRef] = useState<string | null>(null);
  const [fonteVersao, setFonteVersao] = useState<string | null>(null);
  const [fonteUrl, setFonteUrl] = useState<string | null>(null);

  const [gtinBusca, setGtinBusca] = useState(insumo.gtin ?? '');
  const [buscandoEan, setBuscandoEan] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [estimandoIa, setEstimandoIa] = useState(false);
  const [mensagemCaptura, setMensagemCaptura] = useState('');
  const [candidatosBase, setCandidatosBase] = useState<Array<{
    id: string; nome: string; nome_pt: string | null; fonte: string; fonte_versao: string;
    base_qtd: number; base_unidade: 'g' | 'ml'; nutrientes: Record<string, number>; similaridade: number;
  }>>([]);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const unidade = getUnidade(insumo.unidade_medida);
  const dimensional = !!unidade?.fatorBase;
  // Precisa de densidade quando a grandeza física do insumo diverge da
  // grandeza escolhida para expressar a nutrição (ex.: insumo em ml, base em g).
  const precisaDensidade =
    dimensional &&
    ((unidade!.grandeza === 'volume' && baseUnidade === 'g') ||
      (unidade!.grandeza === 'massa' && baseUnidade === 'ml'));
  const precisaPesoMedio = !dimensional;

  useEffect(() => {
    let atual = true;
    (async () => {
      setCarregando(true);
      const [resCatalogo, resNutricao] = await Promise.all([
        supabase.from('nutrientes').select('codigo, rotulo, abreviacao, unidade, ordem, indentacao').eq('ativo', true).order('ordem'),
        supabase.from('insumos_nutricao').select('*').eq('insumo_id', insumo.id).maybeSingle(),
      ]);
      if (!atual) return;

      setCatalogo(resCatalogo.data ?? []);

      const existente = resNutricao.data as InsumoNutricao | null;
      if (existente) {
        setBaseUnidade(existente.base_unidade);
        setPesoMedioUnG(existente.peso_medio_un_g != null ? String(existente.peso_medio_un_g) : '');
        setDensidadeGMl(existente.densidade_g_ml != null ? String(existente.densidade_g_ml) : '');
        setValores(
          Object.fromEntries(Object.entries(existente.nutrientes ?? {}).map(([k, v]) => [k, String(v)])),
        );
        setContem(new Set(existente.alergenos_contem ?? []));
        setPodeConter(new Set(existente.alergenos_pode_conter ?? []));
        setOrigemAtual(existente.origem);
        setRevisadoAtual(existente.revisado);
        setFonteRef(existente.fonte_ref ?? null);
        setFonteVersao(existente.fonte_versao ?? null);
        setFonteUrl(existente.fonte_url ?? null);
      } else {
        // Insumo sem nada cadastrado ainda: tenta a base científica (USDA/TBCA)
        // pelo NOME, de graça e na hora — é o caminho certo pra in natura
        // (tomate, cebola, alho...), que nunca vai ter código de barras (§5.1 ③).
        const { data: candidatos } = await supabase.rpc('fn_buscar_alimento_referencia', {
          p_termo: insumo.nome, p_limite: 4, p_minimo: 0.25,
        });
        const top = candidatos?.[0];
        if (atual && top && top.similaridade >= 0.6) {
          // Confiança alta: aplica direto, só falta o lojista conferir e salvar.
          aplicarCandidatoBase(top);
        } else if (atual && candidatos?.length) {
          // Ambíguo (ex.: "Açúcar" vs. "Açúcar refinado"/"Açúcar mascavo") —
          // mostra as opções em vez de decidir sozinho ou ficar em silêncio.
          setCandidatosBase(candidatos);
        }
      }
      setCarregando(false);
    })();
    return () => { atual = false; };
  }, [insumo.id, insumo.nome]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, item: string) => {
    const novo = new Set(set);
    if (novo.has(item)) novo.delete(item); else novo.add(item);
    setter(novo);
  };

  /** Aplica um candidato da base científica (USDA/TBCA) — auto (alta confiança) ou por escolha manual do lojista. */
  const aplicarCandidatoBase = (c: {
    id: string; nome: string; nome_pt: string | null; fonte: string; fonte_versao: string;
    base_qtd: number; base_unidade: 'g' | 'ml'; nutrientes: Record<string, number>; similaridade: number;
  }) => {
    setBaseUnidade(c.base_unidade);
    setValores(Object.fromEntries(Object.entries(c.nutrientes ?? {}).map(([k, v]) => [k, String(v)])));
    setOrigemAtual(FONTE_PARA_ORIGEM[c.fonte] ?? 'MANUAL');
    setFonteRef(c.id);
    setFonteVersao(c.fonte_versao);
    setFonteUrl(null);
    setCandidatosBase([]);
    setMensagemCaptura(
      `${c.nome_pt || c.nome} · ${ROTULO_FONTE[c.fonte] ?? c.fonte} · ${Math.round(c.similaridade * 100)}%`,
    );
  };

  /** Aplica uma sugestão (EAN ou foto) nos campos do formulário — o lojista revisa e confirma clicando Salvar. */
  const aplicarSugestao = (r: {
    base_qtd?: number; base_unidade: 'g' | 'ml';
    nutrientes: Record<string, number>;
    alergenos_contem: string[]; alergenos_pode_conter?: string[];
    peso_medio_un_g?: number | null;
  }) => {
    setBaseUnidade(r.base_unidade);
    setValores(Object.fromEntries(Object.entries(r.nutrientes).map(([k, v]) => [k, String(v)])));
    setContem(new Set(r.alergenos_contem));
    setPodeConter(new Set(r.alergenos_pode_conter ?? []));
    // Peso líquido identificado (Cosmos) — só preenche se ainda não havia nada digitado.
    if (r.peso_medio_un_g && !pesoMedioUnG) setPesoMedioUnG(String(r.peso_medio_un_g));
    setFonteRef(null); setFonteVersao(null); setFonteUrl(null); // cada chamador define a sua, se tiver
    setRevisadoAtual(false);
  };

  const buscarPorEan = async () => {
    const gtinLimpo = gtinBusca.replace(/\D/g, '');
    if (gtinLimpo.length < 8) return setErro('Digite um código de barras válido (mínimo 8 dígitos).');
    setErro(''); setMensagemCaptura(''); setBuscandoEan(true);

    const { data, error } = await supabase.functions.invoke('nutricao-ean', {
      body: { insumo_id: insumo.id, gtin: gtinLimpo },
    });
    setBuscandoEan(false);

    if (error || !data) return setErro(await motivoReal(error, 'Não foi possível buscar esse código agora. Tente de novo.'));
    if (!data.encontrado) {
      // Identificação parcial: nome e peso já vieram (Cosmos), só falta a nutrição.
      if (data.peso_medio_sugerido_g && !pesoMedioUnG) setPesoMedioUnG(String(data.peso_medio_sugerido_g));
      return setMensagemCaptura(data.motivo || 'Não encontramos esse código.');
    }

    aplicarSugestao(data);
    setOrigemAtual('ROTULO_EAN');
    setFonteUrl(data.fonte_url ?? null);
    setMensagemCaptura(
      `${data.nome_referencia} · Open Food Facts` +
      (data.sanidade_energetica === false ? ' · valores inconsistentes, revise' : ''),
    );
  };

  const capturarFoto = async (file: File) => {
    setErro(''); setMensagemCaptura(''); setEnviandoFoto(true);
    try {
      const { base64, mimeType } = await comprimirImagem(file);
      const { data, error } = await supabase.functions.invoke('nutricao-ocr-rotulo', {
        body: { insumo_id: insumo.id, foto_base64: base64, mime_type: mimeType },
      });
      if (error || !data) { setErro(await motivoReal(error, 'Não foi possível ler a foto agora. Tente de novo.')); return; }
      if (!data.legivel) { setMensagemCaptura(data.motivo || 'Não consegui ler essa foto — tente com mais luz e sem reflexo.'); return; }

      aplicarSugestao(data);
      setOrigemAtual('ROTULO_FOTO');
      setMensagemCaptura(
        'Rótulo lido' +
        (data.sanidade_energetica === false ? ' · valores inconsistentes, revise' : ''),
      );
    } finally {
      setEnviandoFoto(false);
    }
  };

  /**
   * Caminho ④ (§5.1, ADR-04 papel 3): quando não há código de barras nem foto,
   * o Gemini estima a partir só do nome do insumo. Confiança sempre baixa
   * (0,3) — nunca conta para o nível 2 do selo, e continua exigindo Salvar.
   */
  const estimarComIa = async () => {
    setErro(''); setMensagemCaptura(''); setEstimandoIa(true);
    try {
      const { data, error } = await supabase.functions.invoke('nutricao-estimar-ia', {
        body: { insumo_id: insumo.id },
      });
      if (error || !data) { setErro(await motivoReal(error, 'Não foi possível estimar agora. Tente de novo.')); return; }
      if (!data.estimavel) { setMensagemCaptura(data.motivo || 'Não deu para estimar a partir do nome do insumo.'); return; }

      aplicarSugestao(data);
      setOrigemAtual('IA');
      setMensagemCaptura(`Estimativa por IA · ${data.justificativa}`);
    } finally {
      setEstimandoIa(false);
    }
  };

  const nutrientesPreenchidos = useMemo(
    () => Object.fromEntries(
      Object.entries(valores)
        .map(([k, v]) => [k, Number(v.replace(',', '.'))] as const)
        .filter(([, v]) => Number.isFinite(v)),
    ),
    [valores],
  );

  const salvar = async () => {
    setErro('');
    if (Object.keys(nutrientesPreenchidos).length === 0) {
      setErro('Preencha ao menos um valor nutricional.');
      return;
    }
    if (precisaPesoMedio && !pesoMedioUnG) {
      setErro(`Informe o peso médio de 1 "${insumo.unidade_medida}" — sem isso não dá para calcular a massa.`);
      return;
    }
    if (precisaDensidade && !densidadeGMl) {
      setErro('Informe a densidade (g/ml) — o insumo e a nutrição estão em grandezas diferentes.');
      return;
    }

    setSalvando(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('insumos_nutricao').upsert({
      insumo_id: insumo.id,
      loja_id: lojaId,
      base_qtd: 100,
      base_unidade: baseUnidade,
      peso_medio_un_g: precisaPesoMedio && pesoMedioUnG ? Number(pesoMedioUnG.replace(',', '.')) : null,
      densidade_g_ml: precisaDensidade && densidadeGMl ? Number(densidadeGMl.replace(',', '.')) : null,
      nutrientes: nutrientesPreenchidos,
      alergenos_contem: Array.from(contem),
      alergenos_pode_conter: Array.from(podeConter),
      // Proveniência é imutável (ADR-06): confirmar uma sugestão de EAN/foto/
      // base científica não vira "manual" — só a origem em branco é.
      origem: origemAtual ?? 'MANUAL',
      fonte_ref: fonteRef,
      fonte_versao: fonteVersao,
      fonte_url: fonteUrl,
      confianca: 1,
      revisado: true,
      revisado_por: user?.id ?? null,
      revisado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    });
    setSalvando(false);

    if (error) {
      setErro('Não foi possível salvar. Tente novamente em instantes.');
      return;
    }
    onSalvo?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-gray-50 dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>

        <div className="shrink-0 flex items-center justify-between bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Apple size={18} className="text-emerald-600 dark:text-emerald-400" /> Nutrição — {insumo.nome}
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{tDynamic('Digite, busque por código de barras ou fotografe o rótulo — salvar aqui já conta como revisado.')}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
          {carregando ? (
            <div className="flex h-64 items-center justify-center"><MiseOnLoader status="Carregando..." rows={2} /></div>
          ) : (
            <>
              {erro && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-sm font-medium text-red-600 dark:text-red-400">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> <p>{erro}</p>
                </div>
              )}

              {mensagemCaptura && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <Sparkles size={12} className="shrink-0 text-blue-500 dark:text-blue-400" /> {mensagemCaptura}
                </div>
              )}

              {candidatosBase.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">
                    <Info size={14} /> "{insumo.nome}" é ambíguo — qual bate melhor?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {candidatosBase.map((c) => (
                      <button key={c.id} onClick={() => aplicarCandidatoBase(c)}
                        className="rounded-full border border-amber-300 dark:border-amber-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                        {c.nome_pt || c.nome} <span className="opacity-60">({Math.round(c.similaridade * 100)}%)</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs opacity-95 text-amber-700/80 dark:text-amber-400/70">
                    Nenhum bateu? O nome do insumo pode estar genérico demais — considere renomear (ex.: "Açúcar" → "Açúcar Refinado") ou use a captura por código de barras/foto abaixo.
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">{tDynamic('Captura rápida (opcional)')}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      value={gtinBusca}
                      onChange={(e) => setGtinBusca(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && buscarPorEan()}
                      placeholder="Código de barras (EAN)"
                      inputMode="numeric"
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white pl-9 pr-3 py-2.5 text-sm"
                    />
                  </div>
                  <button onClick={buscarPorEan} disabled={buscandoEan || !gtinBusca}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-4 py-2.5 text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors">
                    {buscandoEan ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" /> : <Barcode size={16} />}
                    Buscar
                  </button>
                  <button onClick={() => inputFotoRef.current?.click()} disabled={enviandoFoto}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900 px-4 py-2.5 text-sm font-bold hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 transition-colors">
                    {enviandoFoto ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-700 border-t-transparent" /> : <Camera size={16} />}
                    Fotografar rótulo
                  </button>
                  <input
                    ref={inputFotoRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) capturarFoto(f); e.target.value = ''; }}
                  />
                  <button onClick={estimarComIa} disabled={estimandoIa}
                    title="Último recurso: a IA chuta a partir só do nome do insumo, com confiança baixa"
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 px-4 py-2.5 text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50 transition-colors">
                    {estimandoIa ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" /> : <Wand2 size={16} />}
                    Estimar com IA
                  </button>
                </div>
                <p className="mt-2 text-xs opacity-95 text-gray-400">
                  {tDynamic('Ordem recomendada: código de barras → foto do rótulo → estimativa por IA (menos confiável, sempre marcada em amarelo).')}
                </p>
                {origemAtual && origemAtual !== 'MANUAL' && (
                  <p className={`mt-2.5 text-xs opacity-95 ${origemAtual === 'IA' ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {origemAtual === 'IA' && '⚠ '}
                    Fonte atual: <b>{{ ROTULO_EAN: 'código de barras (Open Food Facts)', ROTULO_FOTO: 'foto do rótulo (lida por IA)', USDA: 'base científica USDA', TBCA: 'base científica TBCA', IA: 'estimativa por IA — NÃO é dado medido' }[origemAtual]}</b>
                    {!revisadoAtual && ' — ainda não revisado. Confira e clique em Salvar para confirmar.'}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{tDynamic('Valores declarados por')}</p>
                <div className="flex gap-2">
                  {(['g', 'ml'] as const).map((u) => (
                    <button key={u} onClick={() => setBaseUnidade(u)}
                      className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                        baseUnidade === u
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}>
                      100 {u}
                    </button>
                  ))}
                </div>
              </div>

              {precisaPesoMedio && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">
                    <Info size={14} /> {tDynamic('Peso médio necessário')}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {tDynamic('Este insumo é controlado em')} <b>"{insumo.unidade_medida}"</b>, que não tem massa universal.
                    Quantos gramas pesa <b>1 {insumo.unidade_medida}</b>?
                  </p>
                  <input value={pesoMedioUnG} onChange={(e) => setPesoMedioUnG(e.target.value)}
                    type="text" inputMode="decimal" placeholder="ex.: 50"
                    className="w-32 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white px-3 py-2 text-sm" />
                  <span className="ml-2 text-sm text-gray-500">gramas</span>
                </div>
              )}

              {precisaDensidade && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">
                    <Info size={14} /> {tDynamic('Densidade necessária')}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {tDynamic('O insumo é controlado em')} <b>{insumo.unidade_medida}</b> mas os valores acima são por <b>100 {baseUnidade}</b> — sem densidade não dá para converter.
                  </p>
                  <input value={densidadeGMl} onChange={(e) => setDensidadeGMl(e.target.value)}
                    type="text" inputMode="decimal" placeholder="ex.: 0,92"
                    className="w-32 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white px-3 py-2 text-sm" />
                  <span className="ml-2 text-sm text-gray-500">g/ml</span>
                </div>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                  Nutrientes (por 100 {baseUnidade})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {catalogo.map((n) => (
                    <div key={n.codigo} style={{ marginLeft: n.indentacao * 10 }}>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        {n.rotulo}
                      </label>
                      <div className="relative">
                        <input
                          value={valores[n.codigo] ?? ''}
                          onChange={(e) => setValores((v) => ({ ...v, [n.codigo]: e.target.value }))}
                          type="text" inputMode="decimal" placeholder="0"
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white pl-3 pr-10 py-2 text-sm"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-90 font-bold text-gray-400">{n.unidade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{tDynamic('Contém alérgeno')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ALERGENOS.map((a) => (
                    <button key={a} onClick={() => toggle(contem, setContem, a)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        contem.has(a)
                          ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{tDynamic('Pode conter (contaminação cruzada)')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ALERGENOS.filter((a) => !contem.has(a)).map((a) => (
                    <button key={a} onClick={() => toggle(podeConter, setPodeConter, a)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        podeConter.has(a)
                          ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}>
                      {a}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs opacity-95 text-gray-400">
                  {tDynamic('Alérgeno não marcado aqui significa "não avaliado" — nunca "não contém".')}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <button onClick={salvar} disabled={salvando || carregando}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md transition-colors disabled:opacity-50">
            {salvando ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <CheckCircle2 size={16} />}
            Salvar nutrição
          </button>
        </div>
      </div>
    </div>
  );
}

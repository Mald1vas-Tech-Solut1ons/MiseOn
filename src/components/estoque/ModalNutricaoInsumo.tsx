import { useEffect, useMemo, useState } from 'react';
import { X, Apple, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, InsumoNutricao } from '../../types';
import { getUnidade } from '../../lib/unidades';
import MiseOnLoader from '../MiseOnLoader';

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
 * NUT-08 — a via de escape que sempre funciona: cadastro manual de nutrição
 * por insumo, direto do painel de Estoque. Zero dependência de IA, foto ou
 * base científica. origem='MANUAL' e revisado=true na hora — o próprio ato
 * de digitar e salvar aqui É a revisão (ADR-02).
 */
export default function ModalNutricaoInsumo({ insumo, lojaId, onClose, onSalvo }: Props) {
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
      }
      setCarregando(false);
    })();
    return () => { atual = false; };
  }, [insumo.id]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, item: string) => {
    const novo = new Set(set);
    if (novo.has(item)) novo.delete(item); else novo.add(item);
    setter(novo);
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
      origem: 'MANUAL',
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
            <p className="text-xs text-gray-500 font-medium mt-0.5">Cadastro manual. Salvar aqui já conta como revisado.</p>
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

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Valores declarados por</p>
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
                    <Info size={14} /> Peso médio necessário
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Este insumo é controlado em <b>"{insumo.unidade_medida}"</b>, que não tem massa universal.
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
                    <Info size={14} /> Densidade necessária
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    O insumo é controlado em <b>{insumo.unidade_medida}</b> mas os valores acima são por <b>100 {baseUnidade}</b> — sem densidade não dá para converter.
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
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{n.unidade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Contém alérgeno</p>
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
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Pode conter (contaminação cruzada)</p>
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
                <p className="mt-2 text-[11px] text-gray-400">
                  Alérgeno não marcado aqui significa "não avaliado" — nunca "não contém".
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

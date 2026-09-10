import { useEffect, useMemo, useState } from 'react';
import { Trash2, Scissors, Scale, Info, Check, Loader2, TrendingDown, ShoppingBag } from 'lucide-react';
import { Insumo } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import { opcoesDeEntrada } from '../../lib/unidades';
import SeletorInsumo from './SeletorInsumo';
import {
  Tecnica, OrigemRendimento, ROTULO_ORIGEM, TIPO_ROTULO,
  buscarRendimento, registrarRendimentoMedido, fatorCorrecao,
} from '../../lib/producao/tecnicas';
import { LinhaFicha, fatorParaEstoque } from '../../lib/producao/linhaFicha';
import { compradoPronto } from '../../lib/fichaTecnica';

const num = (v: string) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const fmtQtd = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

interface Props {
  indice: number;
  linha: LinhaFicha;
  insumos: Insumo[];
  jaUsados: string[];
  tecnicas: Tecnica[];
  onChange: (linha: LinhaFicha) => void;
  onRemover: () => void;
}

export default function LinhaFichaInsumo({
  indice, linha, insumos, jaUsados, tecnicas, onChange, onRemover,
}: Props) {
  const { tDynamic } = useI18n();
  const insumo = insumos.find(i => i.id === linha.insumo_id);

  const [rendimentoSistema, setRendimentoSistema] = useState<{ pct: number | null; origem: OrigemRendimento | null; amostras?: number }>({ pct: null, origem: null });
  const [buscando, setBuscando] = useState(false);
  const [medindo, setMedindo] = useState(false);
  const [pesoBruto, setPesoBruto] = useState('');
  const [pesoLiquido, setPesoLiquido] = useState('');
  const [salvandoMedicao, setSalvandoMedicao] = useState(false);
  const [erroMedicao, setErroMedicao] = useState<string | null>(null);

  const unidadesAceitas = useMemo(() => {
    if (!insumo) return [];
    return opcoesDeEntrada(
      insumo.unidade_medida,
      insumo.detalhes_rendimento?.regras,
      insumo.detalhes_rendimento?.equivalencias,
    );
  }, [insumo]);

  // Insumo trocou: a unidade da linha anterior pode não existir mais aqui.
  useEffect(() => {
    if (!insumo) return;
    const valida = linha.unidade && unidadesAceitas.some(o => o.codigo === linha.unidade);
    if (!valida) onChange({ ...linha, unidade: insumo.unidade_medida });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insumo?.id, unidadesAceitas.length]);

  // Busca o fator de correção que o sistema conhece para este par e publica o
  // resultado na própria linha — é o número que o salvamento vai congelar.
  useEffect(() => {
    if (!linha.insumo_id || !linha.tecnica_codigo) {
      setRendimentoSistema({ pct: null, origem: null });
      if (linha.rendimento_sistema_pct != null || linha.rendimento_origem != null) {
        onChange({ ...linha, rendimento_sistema_pct: null, rendimento_origem: null });
      }
      return;
    }
    let cancelado = false;
    setBuscando(true);
    buscarRendimento(linha.insumo_id, linha.tecnica_codigo)
      .then(r => {
        if (cancelado) return;
        setRendimentoSistema({ pct: r.rendimento_pct, origem: r.origem, amostras: r.amostras });
        onChange({
          ...linha,
          rendimento_sistema_pct: r.rendimento_pct,
          rendimento_origem: linha.rendimento_pct !== '' ? 'USUARIO' : r.origem,
        });
      })
      .finally(() => { if (!cancelado) setBuscando(false); });
    return () => { cancelado = true; };
    // Depende só do par: incluir `linha` inteira realimentaria o efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linha.insumo_id, linha.tecnica_codigo]);

  const fator = fatorParaEstoque(insumo, linha.unidade);
  const brutoNaUnidadeDeEstoque = fator != null ? num(linha.quantidade) * fator : 0;

  const pctManual = linha.rendimento_pct === '' ? null : num(linha.rendimento_pct) / 100;
  const pctEfetivo = pctManual ?? rendimentoSistema.pct;
  const origemEfetiva: OrigemRendimento | null = pctManual != null ? 'USUARIO' : rendimentoSistema.origem;
  const liquido = brutoNaUnidadeDeEstoque * (pctEfetivo ?? 1);
  const perda = brutoNaUnidadeDeEstoque - liquido;

  // Item comprado pronto não tem limpeza a fazer: o queijo do saquinho já vem
  // ralado. Oferecer "descascar" ali seria o sistema fingindo que não sabe.
  const ehRevenda = insumo ? compradoPronto(insumo) : false;

  const porTipo = useMemo(() => {
    const grupos = new Map<string, Tecnica[]>();
    for (const t of tecnicas) {
      if (ehRevenda && t.tipo === 'LIMPEZA') continue;
      const lista = grupos.get(t.tipo) ?? [];
      lista.push(t);
      grupos.set(t.tipo, lista);
    }
    return [...grupos.entries()];
  }, [tecnicas, ehRevenda]);

  const tecnicaSelecionada = tecnicas.find(t => t.codigo === linha.tecnica_codigo);

  const salvarMedicao = async () => {
    setErroMedicao(null);
    setSalvandoMedicao(true);
    try {
      const r = await registrarRendimentoMedido(
        linha.insumo_id, linha.tecnica_codigo, num(pesoBruto), num(pesoLiquido),
      );
      setRendimentoSistema({ pct: r.rendimento_pct, origem: r.origem, amostras: r.amostras });
      // A medição da casa passa a valer: derruba qualquer sobrescrita manual.
      onChange({
        ...linha,
        rendimento_pct: '',
        rendimento_origem: 'MEDIDO_LOJA',
        rendimento_sistema_pct: r.rendimento_pct ?? null,
      });
      setMedindo(false);
      setPesoBruto('');
      setPesoLiquido('');
    } catch (e) {
      setErroMedicao(e instanceof Error ? e.message : 'Não foi possível registrar a pesagem.');
    } finally {
      setSalvandoMedicao(false);
    }
  };

  return (
    <div className="rounded-xl border border-orange-100 bg-white p-3 shadow-sm dark:border-orange-900/40 dark:bg-gray-950">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-black text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
          {indice + 1}
        </span>

        <SeletorInsumo
          insumos={insumos}
          valor={linha.insumo_id}
          jaUsados={jaUsados}
          onChange={id => onChange({ ...linha, insumo_id: id, tecnica_codigo: '', rendimento_pct: '', rendimento_origem: null })}
        />

        <div className="flex w-40 shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <input
            value={linha.quantidade}
            onChange={e => onChange({ ...linha, quantidade: e.target.value })}
            type="number" min="0" step="any" placeholder="Qtd"
            className="min-w-0 flex-1 bg-transparent p-2 text-center text-sm font-bold dark:text-gray-100"
          />
          {unidadesAceitas.length > 1 ? (
            <select
              value={linha.unidade}
              onChange={e => onChange({ ...linha, unidade: e.target.value })}
              title={tDynamic('Unidade em que você conta na cozinha')}
              className="w-20 shrink-0 border-l border-gray-200 bg-gray-50 px-1 text-xs font-black text-gray-600 outline-none dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300"
            >
              {unidadesAceitas.map(o => (
                <option key={o.codigo} value={o.codigo}>{o.codigo}</option>
              ))}
            </select>
          ) : (
            <span className="flex w-20 shrink-0 items-center justify-center border-l border-gray-200 bg-gray-100 px-1 text-xs font-black text-gray-500 dark:border-gray-800 dark:bg-gray-800">
              {insumo?.unidade_medida ?? '—'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRemover}
          title={tDynamic('Remover linha')}
          className="shrink-0 rounded-lg bg-red-50 p-2 text-red-400 hover:text-red-600 dark:bg-red-900/20"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {insumo && (
        <div className="mt-2.5 space-y-2 border-t border-gray-100 pt-2.5 dark:border-gray-800">
          {ehRevenda && (
            <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 p-2 text-[11px] leading-snug text-sky-800 dark:bg-sky-950/20 dark:text-sky-300">
              <ShoppingBag size={13} className="mt-px shrink-0" />
              <span>
                <b>{tDynamic('Comprado pronto.')}</b>{' '}
                {tDynamic('O custo é o da nota e não há limpeza a medir. Se a sua equipe é que faz esse trabalho (ralar o queijo, limpar a peça), crie uma ficha própria — vira preparo da casa, com custo de produção e lote rastreável.')}
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400">
              <Scissors size={12} /> {tDynamic('Pré-preparo')}
            </label>
            <select
              value={linha.tecnica_codigo}
              onChange={e => onChange({ ...linha, tecnica_codigo: e.target.value, rendimento_pct: '', rendimento_origem: null })}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent p-1.5 text-xs font-semibold dark:border-gray-800 dark:text-gray-100"
            >
              <option value="">{tDynamic('Nenhum — entra como está')}</option>
              {porTipo.map(([tipo, lista]) => (
                <optgroup key={tipo} label={tDynamic(TIPO_ROTULO[tipo as keyof typeof TIPO_ROTULO] ?? tipo)}>
                  {lista.map(t => <option key={t.codigo} value={t.codigo}>{t.rotulo}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {tecnicaSelecionada?.descricao && (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-400">
              <Info size={12} className="mt-px shrink-0" /> {tecnicaSelecionada.descricao}
            </p>
          )}

          {linha.tecnica_codigo && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/10">
              {buscando ? (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <Loader2 size={13} className="animate-spin" /> {tDynamic('Consultando o rendimento…')}
                </p>
              ) : pctEfetivo == null ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    {tDynamic('O MiseOn não tem rendimento de referência para esta combinação — e não vai chutar.')}
                  </p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-500/80">
                    {tDynamic('Pese uma vez e o número passa a ser o da sua cozinha, ou informe o % que você já conhece.')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-300">
                      <TrendingDown size={13} />
                      {tDynamic('Rendimento')} {(pctEfetivo * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                      <span className="font-bold text-amber-700/70 dark:text-amber-500/70">
                        · FC {fatorCorrecao(pctEfetivo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      </span>
                    </span>
                    {origemEfetiva && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                        origemEfetiva === 'MEDIDO_LOJA'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-amber-200/70 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}>
                        {tDynamic(ROTULO_ORIGEM[origemEfetiva])}
                        {origemEfetiva === 'MEDIDO_LOJA' && rendimentoSistema.amostras
                          ? ` · ${rendimentoSistema.amostras}×` : ''}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {tDynamic('Sai do estoque')} <b className="text-gray-900 dark:text-gray-100">{fmtQtd(brutoNaUnidadeDeEstoque)} {insumo.unidade_medida}</b>
                    {' → '}
                    {tDynamic('entra no preparo')} <b className="text-emerald-700 dark:text-emerald-400">{fmtQtd(liquido)} {insumo.unidade_medida}</b>
                    {perda > 0 && (
                      <span className="text-gray-400"> · {tDynamic('perda')} {fmtQtd(perda)} {insumo.unidade_medida}</span>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-gray-400">
                    {tDynamic('O custo conta o bruto (você pagou pela casca). A caloria conta o líquido.')}
                  </p>
                </>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-amber-200/70 pt-2 dark:border-amber-900/40">
                <label className="flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-400">
                  {tDynamic('Ajustar %')}
                  <input
                    value={linha.rendimento_pct}
                    onChange={e => onChange({ ...linha, rendimento_pct: e.target.value, rendimento_origem: e.target.value === '' ? null : 'USUARIO' })}
                    type="number" min="1" max="100" step="any"
                    placeholder={pctEfetivo != null ? String(Math.round(pctEfetivo * 100)) : '—'}
                    className="w-16 rounded-lg border border-amber-300 bg-white p-1 text-center text-xs font-bold dark:border-amber-900/50 dark:bg-gray-950 dark:text-gray-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setMedindo(m => !m)}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm hover:bg-emerald-700"
                >
                  <Scale size={12} /> {tDynamic('Pesei aqui')}
                </button>
              </div>

              {medindo && (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <p className="mb-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                    {tDynamic('Pese antes e depois do pré-preparo. Cada pesagem melhora a média da sua casa.')}
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                      {tDynamic('Bruto')}
                      <input value={pesoBruto} onChange={e => setPesoBruto(e.target.value)} type="number" min="0" step="any"
                        className="mt-0.5 block w-24 rounded-lg border border-emerald-300 bg-white p-1.5 text-center text-sm font-bold dark:border-emerald-900/50 dark:bg-gray-950 dark:text-gray-100" />
                    </label>
                    <label className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                      {tDynamic('Líquido')}
                      <input value={pesoLiquido} onChange={e => setPesoLiquido(e.target.value)} type="number" min="0" step="any"
                        className="mt-0.5 block w-24 rounded-lg border border-emerald-300 bg-white p-1.5 text-center text-sm font-bold dark:border-emerald-900/50 dark:bg-gray-950 dark:text-gray-100" />
                    </label>
                    <button
                      type="button"
                      onClick={salvarMedicao}
                      disabled={salvandoMedicao || num(pesoBruto) <= 0 || num(pesoLiquido) <= 0}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                    >
                      {salvandoMedicao ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      {tDynamic('Registrar')}
                    </button>
                  </div>
                  {erroMedicao && <p className="mt-2 text-[11px] font-bold text-red-600 dark:text-red-400">{erroMedicao}</p>}
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            {tDynamic('Disponível')}: <b>{fmtQtd(Number(insumo.quantidade_atual ?? 0))} {insumo.unidade_medida}</b>
            {fator == null && (
              <span className="ml-1.5 font-bold text-amber-600">
                · {tDynamic('esta unidade não tem conversão declarada para o estoque')}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

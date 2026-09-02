import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Apple, CheckCircle2, ChevronRight, Info, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';
import type { Insumo } from '../../types';
import { ATRIBUTOS, formatarValor, type ConfigNutricaoPrato } from '../../lib/nutricao';

/**
 * Presets de cocção. O fator mexe na MASSA servida, não nos nutrientes —
 * perder água na chapa não destrói proteína. O óleo absorvido na fritura entra
 * pela ficha técnica, onde já precisa estar para o custo fechar.
 */
const METODOS: Array<{ valor: string; rotulo: string; fator: number; ajuda: string }> = [
  { valor: 'MONTADO',  rotulo: 'Montado / cru',   fator: 1.00, ajuda: 'Sai como foi montado — nada evapora.' },
  { valor: 'GRELHADO', rotulo: 'Chapa / grelha',  fator: 0.88, ajuda: 'Perde água na chapa: pesa menos do que a soma dos ingredientes.' },
  { valor: 'FRITO',    rotulo: 'Fritura',         fator: 0.85, ajuda: 'Perde água e absorve óleo — lance o óleo absorvido na ficha.' },
  { valor: 'ASSADO',   rotulo: 'Forno',           fator: 0.80, ajuda: 'Assar concentra: sai bem mais leve.' },
  { valor: 'COZIDO',   rotulo: 'Cozido em água',  fator: 1.05, ajuda: 'Absorve água: sai mais pesado que o cru.' },
];

interface Resultado {
  status: 'COMPLETO' | 'PARCIAL' | 'SEM_DADOS';
  nutrientes: Record<string, number>;
  massa_g: number;
  itens_total: number;
  itens_com_dado: number;
  alergenos_contem: string[];
  alergenos_pode_conter: string[];
  insumos_faltantes: Array<{ insumo_id: string; nome: string; motivo: string }>;
  alertas: Array<{ codigo: string; detalhe: string }>;
  composicao_fontes: Record<string, number>;
}

/**
 * O bloco de nutrição dentro do editor de produto.
 *
 * Duas funções, e as duas importam:
 *  - **prever**: enquanto o lojista monta a ficha, ele já vê o que vai sair na
 *    vitrine — e, principalmente, o que falta para sair. A lacuna aparece com
 *    nome de insumo e motivo, não como "dados insuficientes";
 *  - **configurar**: quantas porções o prato rende, quanto pesa a porção e o
 *    que a cocção faz com a massa.
 */
export default function NutricaoDoPrato({
  lojaId,
  ficha,
  insumos,
  config,
  onConfigChange,
}: {
  lojaId: string;
  ficha: Array<{ insumo_id: string; quantidade_consumida: string }>;
  insumos: Insumo[];
  config: ConfigNutricaoPrato;
  onConfigChange: (c: ConfigNutricaoPrato) => void;
}) {
  const { tDynamic } = useI18n();
  const [res, setRes] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);

  // Linhas válidas da ficha em edição — ou, sem ficha, o vínculo de revenda.
  const linhas = useMemo(() => {
    const daFicha = ficha
      .filter((f) => f.insumo_id && Number(f.quantidade_consumida) > 0)
      .map((f) => ({ insumo_id: f.insumo_id, quantidade: Number(f.quantidade_consumida) }));
    if (daFicha.length) return daFicha;
    if (config.insumo_id) {
      return [{ insumo_id: config.insumo_id, quantidade: Number(config.quantidade_insumo || 1) }];
    }
    return [];
  }, [ficha, config.insumo_id, config.quantidade_insumo]);

  const chave = JSON.stringify(linhas);

  useEffect(() => {
    if (!linhas.length) { setRes(null); return; }
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(async () => {
      // fn_simular_nutricao é o MESMO motor da vitrine, em modo permissivo:
      // inclui dado ainda não revisado para o lojista ver progresso ao vivo.
      const { data } = await supabase.rpc('fn_simular_nutricao', { p_linhas: linhas, p_loja_id: lojaId });
      if (!vivo) return;
      setRes((data as Resultado) ?? null);
      setCarregando(false);
    }, 400);
    return () => { vivo = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, lojaId]);

  const massaServida = (res?.massa_g ?? 0) * (config.fator_coccao || 1);
  const pesoPorcao = config.peso_porcao_g ?? (config.porcoes > 0 ? massaServida / config.porcoes : massaServida);
  const kcalPorcao = massaServida > 0 && res
    ? ((res.nutrientes?.ENERGIA_KCAL ?? 0) * pesoPorcao) / massaServida
    : 0;

  const atributos = useMemo(() => {
    if (!res || massaServida <= 0) return [] as string[];
    const por100 = Object.fromEntries(
      Object.entries(res.nutrientes ?? {}).map(([k, v]) => [k, (v * 100) / massaServida]),
    ) as Record<string, number>;
    const lista: string[] = [];
    if (por100.PROTEINAS >= 12) lista.push('ALTO_PROTEINA');
    else if (por100.PROTEINAS >= 6) lista.push('FONTE_PROTEINA');
    if (por100.FIBRAS_ALIMENTARES >= 6) lista.push('ALTO_FIBRAS');
    else if (por100.FIBRAS_ALIMENTARES >= 3) lista.push('FONTE_FIBRAS');
    if (por100.SODIO <= 120) lista.push('BAIXO_SODIO');
    return lista;
  }, [res, massaServida]);

  const revenda = ficha.filter((f) => f.insumo_id && Number(f.quantidade_consumida) > 0).length === 0;
  const publicavel = res?.status === 'COMPLETO' && (res?.alertas?.length ?? 0) === 0 && config.exibir;

  return (
    <div className="mt-4 rounded-2xl border p-3 dark:border-gray-800">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold dark:text-gray-200">
          <Apple size={14} className="text-emerald-600" /> {tDynamic('Informação nutricional')}
        </p>
        {carregando && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </div>

      {/* ── Estado atual, em uma frase ─────────────────────────────── */}
      {!res && !carregando && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {revenda
            ? 'Este produto não tem ficha técnica. Se ele é revenda (bebida, doce, água), aponte o insumo abaixo e a tabela sai do rótulo.'
            : 'Monte a ficha técnica acima e a tabela aparece aqui na hora.'}
        </p>
      )}

      {res && (
        <>
          <div
            className={`mt-2 rounded-xl border p-2.5 text-xs ${
              publicavel
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
            }`}
          >
            <p className="flex items-center gap-1.5 font-bold">
              {publicavel ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-900 dark:text-emerald-200">{tDynamic('Publicando no cardápio')}</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-900 dark:text-amber-200">
                    {tDynamic(config.exibir ? 'Ainda não publica' : 'Exibição desligada por você')}
                  </span>
                </>
              )}
            </p>

            <p className="mt-1 text-gray-700 dark:text-gray-300">
              {res.itens_com_dado} de {res.itens_total} ingredientes com dado ·{' '}
              {formatarValor(massaServida, 'g')} g servidos · {formatarValor(kcalPorcao, 'kcal')} kcal por porção
            </p>

            {/* A lacuna vira tarefa: nome do insumo e o que fazer. */}
            {res.insumos_faltantes?.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {res.insumos_faltantes.slice(0, 6).map((f) => (
                  <li key={f.insumo_id} className="flex items-start gap-1 text-[11px] text-amber-900 dark:text-amber-200">
                    <ChevronRight size={11} className="mt-0.5 shrink-0" />
                    <span>
                      <strong className="font-semibold">{f.nome}</strong> — {f.motivo}
                    </span>
                  </li>
                ))}
                {res.insumos_faltantes.length > 6 && (
                  <li className="text-[11px] text-amber-800 dark:text-amber-300">
                    e mais {res.insumos_faltantes.length - 6}…
                  </li>
                )}
                <li className="pt-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                  {tDynamic('Resolva em Estoque → botão da maçã em cada insumo (código de barras, foto do rótulo ou IA).')}
                </li>
              </ul>
            )}

            {res.alertas?.map((a) => (
              <p key={a.codigo} className="mt-1.5 flex items-start gap-1 text-[11px] font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {a.detalhe}
              </p>
            ))}
          </div>

          {(res.alergenos_contem?.length > 0 || atributos.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {atributos.map((a) => (
                <span key={a} title={ATRIBUTOS[a]?.criterio}
                  className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {ATRIBUTOS[a]?.rotulo ?? a}
                </span>
              ))}
              {res.alergenos_contem?.map((a) => (
                <span key={a} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                  contém {a.toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Configuração ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="mt-2.5 text-[11px] font-semibold text-[var(--cor-primaria)] underline underline-offset-2"
      >
        {tDynamic(aberto ? 'Ocultar ajustes' : 'Ajustar porção, cocção e exibição')}
      </button>

      {aberto && (
        <div className="mt-2 space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <label className="flex items-center gap-2 text-xs dark:text-gray-300">
            <input
              type="checkbox"
              checked={config.exibir}
              onChange={(e) => onConfigChange({ ...config, exibir: e.target.checked })}
            />
            {tDynamic('Exibir a tabela deste prato no cardápio')}
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {tDynamic('Rende quantas porções')}
              <input
                type="number" min={1} step={1} value={config.porcoes}
                onChange={(e) => onConfigChange({ ...config, porcoes: Math.max(1, Number(e.target.value) || 1) })}
                className="mt-0.5 w-full rounded-lg border p-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {tDynamic('Peso da porção (g)')}
              <input
                type="number" min={0} step={1}
                placeholder={massaServida > 0 ? String(Math.round(pesoPorcao)) : 'automático'}
                value={config.peso_porcao_g ?? ''}
                onChange={(e) => onConfigChange({ ...config, peso_porcao_g: e.target.value ? Number(e.target.value) : null })}
                className="mt-0.5 w-full rounded-lg border p-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
          </div>

          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{tDynamic('Como é preparado')}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {METODOS.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  title={m.ajuda}
                  onClick={() => onConfigChange({ ...config, metodo_coccao: m.valor, fator_coccao: m.fator })}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    config.metodo_coccao === m.valor
                      ? 'bg-[var(--cor-primaria)] text-white'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {m.rotulo}
                </button>
              ))}
            </div>
            <p className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
              <Info size={10} className="mt-0.5 shrink-0" />
              O fator ({config.fator_coccao.toFixed(2).replace('.', ',')}×) ajusta apenas o <strong>peso</strong> do
              que chega ao prato. Os nutrientes não mudam — água que evapora não leva proteína embora.
            </p>
          </div>

          {revenda && (
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {tDynamic('Revenda: este produto é um item pronto')}
              </p>
              <div className="mt-1 flex gap-1.5">
                <select
                  value={config.insumo_id ?? ''}
                  onChange={(e) => onConfigChange({
                    ...config,
                    insumo_id: e.target.value || null,
                    quantidade_insumo: e.target.value ? (config.quantidade_insumo ?? 1) : null,
                  })}
                  className="flex-1 rounded-lg border p-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Não é revenda</option>
                  {insumos.filter((i) => !i.is_preparo).map((i) => (
                    <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>
                  ))}
                </select>
                {config.insumo_id && (
                  <input
                    type="number" min={0} step="any" value={config.quantidade_insumo ?? 1}
                    onChange={(e) => onConfigChange({ ...config, quantidade_insumo: Number(e.target.value) || 1 })}
                    className="w-20 rounded-lg border p-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                )}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                Uma lata de refrigerante não tem receita — tem rótulo. Apontando o insumo, a tabela sai do
                rótulo dele sem precisar de ficha técnica de mentira.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

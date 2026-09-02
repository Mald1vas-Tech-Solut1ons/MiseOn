import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Flame, Info, ShieldCheck } from 'lucide-react';
import {
  ATRIBUTOS,
  DISCLAIMER_CURTO,
  DISCLAIMER_LONGO,
  descreverFontes,
  formatarValor,
  percentualVD,
  somarNutrientes,
  unirAlergenos,
  type NutricaoOpcao,
  type NutricaoProduto,
  type NutrienteCatalogo,
} from '../../lib/nutricao';

export type { NutricaoProduto } from '../../lib/nutricao';

interface Props {
  dados: NutricaoProduto;
  /** Catálogo oficial: ordem, rótulo, indentação e VDR vêm do banco, não daqui. */
  catalogo: NutrienteCatalogo[];
  /** Adicionais que o cliente marcou — a tabela reage à escolha dele. */
  extras?: NutricaoOpcao[];
  /** Observação que o próprio lojista escreveu (Loja → Segmento & Módulos). */
  observacaoLoja?: string | null;
}

/**
 * A tabela que o cliente lê antes de decidir o pedido.
 *
 * Três regras de projeto, nesta ordem:
 *
 *  1. **Alérgeno primeiro.** Quem lê isto por necessidade, e não por
 *     curiosidade, está procurando "tem leite?" — não "quantas calorias?".
 *     O aviso aparece antes de qualquer número e sem precisar expandir nada.
 *  2. **Ausência nunca é garantia.** A lista diz o que foi avaliado. Não
 *     estar na lista significa "não avaliado" — está escrito com essas
 *     palavras (ADR-03 do PLANO-NUTRICIONAL).
 *  3. **Nunca só cor.** Alérgeno, atributo e aviso de parcial têm ícone e
 *     texto; a cor é reforço, não portadora do significado.
 */
export default function TabelaNutricional({ dados, catalogo, extras = [], observacaoLoja }: Props) {
  const [aberto, setAberto] = useState(false);
  const [base, setBase] = useState<'porcao' | '100g'>('porcao');
  const [metodoAberto, setMetodoAberto] = useState(false);

  const temExtras = extras.length > 0;

  // Com adicional escolhido, o "por 100 g" perderia o sentido (100 g de quê?),
  // então a tabela passa a falar só do prato como ele vai sair.
  const { porPorcao, por100g, pesoPorcao, alergenos } = useMemo(() => {
    const alerg = unirAlergenos([
      { contem: dados.alergenos_contem ?? [], pode: dados.alergenos_pode_conter ?? [] },
      ...extras.map((e) => ({ contem: e.alergenos_contem ?? [], pode: e.alergenos_pode_conter ?? [] })),
    ]);

    const somaExtras = extras.map((e) => e.nutrientes);
    const porcao = somarNutrientes(dados.por_porcao ?? {}, somaExtras);
    const peso = (dados.peso_porcao_g ?? dados.massa_servida_g) + extras.reduce((s, e) => s + (e.massa_g ?? 0), 0);
    const cem = peso > 0
      ? Object.fromEntries(Object.entries(porcao).map(([k, v]) => [k, (v * 100) / peso]))
      : (dados.por_100g ?? {});

    return { porPorcao: porcao, por100g: cem, pesoPorcao: peso, alergenos: alerg };
  }, [dados, extras]);

  const valores = base === 'porcao' ? porPorcao : por100g;
  const linhas = useMemo(
    () =>
      catalogo.filter(
        (n) =>
          n.ativo &&
          Number.isFinite(valores?.[n.codigo]) &&
          // Nutriente opcional zerado é ruído: "Álcool (etanol) 0 g" num
          // hambúrguer não informa nada. Os obrigatórios da ANVISA ficam
          // sempre, inclusive zerados — ali o zero é a informação.
          (n.obrigatorio_anvisa || valores[n.codigo] > 0),
      ),
    [catalogo, valores],
  );

  const kcal = porPorcao?.ENERGIA_KCAL;
  const temNumero = dados.publicavel && linhas.length > 0;
  const temAlergeno = alergenos.contem.length > 0 || alergenos.pode.length > 0;

  // Sem número e sem alérgeno não há nada de honesto a dizer.
  if (!temNumero && !temAlergeno) return null;

  const atributos = (dados.atributos ?? []).filter((a) => ATRIBUTOS[a]);
  const fontes = descreverFontes(dados.composicao_fontes ?? {});

  return (
    <section
      aria-label="Informação nutricional"
      className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900/60"
    >
      {/* ── Resumo: o que decide o pedido, sem clique ───────────────── */}
      <div className="space-y-2.5 p-3">
        {temNumero && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-black text-white dark:bg-gray-100 dark:text-gray-900">
              <Flame size={12} strokeWidth={2.5} />
              {formatarValor(kcal, 'kcal')} kcal
              {!temExtras && dados.porcoes > 1 && <span className="font-semibold opacity-70">/porção</span>}
            </span>

            {atributos.map((a) => (
              <span
                key={a}
                title={ATRIBUTOS[a].criterio}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  ATRIBUTOS[a].tom === 'forte'
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950'
                    : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900'
                }`}
              >
                <ShieldCheck size={11} strokeWidth={2.5} />
                {ATRIBUTOS[a].rotulo}
              </span>
            ))}
          </div>
        )}

        {/* Alérgeno: destaque próprio, ícone + palavra, nunca só cor. */}
        {temAlergeno && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-800/60 dark:bg-amber-950/30">
            <div className="flex gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
              <div className="min-w-0 text-[12px] leading-relaxed">
                {alergenos.contem.length > 0 && (
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    Contém: {alergenos.contem.join(', ')}.
                  </p>
                )}
                {alergenos.pode.length > 0 && (
                  <p className="text-amber-900/90 dark:text-amber-200/90">
                    Pode conter: {alergenos.pode.join(', ')}.
                  </p>
                )}
                <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/70">
                  Esta é a lista do que foi avaliado pelo estabelecimento. Não estar aqui significa{' '}
                  <strong className="font-semibold">não avaliado</strong>, e não ausência garantida.
                </p>
              </div>
            </div>
          </div>
        )}

        {!temNumero && temAlergeno && (
          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            Os valores nutricionais deste item ainda estão sendo levantados
            {dados.itens_total > 0 && ` (${dados.itens_com_dado} de ${dados.itens_total} ingredientes prontos)`}.
          </p>
        )}
      </div>

      {/* ── Tabela completa ─────────────────────────────────────────── */}
      {temNumero && (
        <>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="flex w-full items-center justify-between gap-2 border-t border-gray-100 px-3 py-2.5 text-left text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800/40"
          >
            <span>Tabela nutricional completa</span>
            <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
          </button>

          {aberto && (
            <div className="border-t border-gray-100 px-3 pb-3 pt-2.5 dark:border-gray-800">
              {temExtras ? (
                <p className="mb-2 rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                  Incluindo os adicionais que você escolheu · porção de {formatarValor(pesoPorcao, 'g')} g
                </p>
              ) : (
                <div className="mb-2.5 flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                  {([
                    ['porcao', dados.porcoes > 1 ? 'Por porção' : 'Porção inteira'],
                    ['100g', 'Por 100 g'],
                  ] as const).map(([valor, texto]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setBase(valor)}
                      aria-pressed={base === valor}
                      className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors ${
                        base === valor
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
              )}

              <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
                {base === 'porcao' || temExtras
                  ? `Porção de ${formatarValor(pesoPorcao, 'g')} g${dados.porcoes > 1 ? ` · o prato rende ${dados.porcoes} porções` : ''}`
                  : 'Valores por 100 g do produto como é servido'}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">
                    Informação nutricional {base === 'porcao' ? 'por porção' : 'por 100 gramas'}
                  </caption>
                  <thead>
                    <tr className="border-b-2 border-gray-900 dark:border-gray-100">
                      <th scope="col" className="py-1.5 text-left font-bold text-gray-900 dark:text-gray-100">
                        Nutriente
                      </th>
                      <th scope="col" className="py-1.5 text-right font-bold text-gray-900 dark:text-gray-100">
                        Quantidade
                      </th>
                      <th scope="col" className="w-14 py-1.5 text-right font-bold text-gray-900 dark:text-gray-100">
                        %VD*
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((n) => {
                      const valor = valores[n.codigo];
                      const vd = percentualVD(valor, n.vdr);
                      const destaque = n.indentacao === 0;
                      return (
                        <tr key={n.codigo} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                          <th
                            scope="row"
                            className={`py-1.5 text-left font-normal ${
                              destaque
                                ? 'font-semibold text-gray-900 dark:text-gray-100'
                                : 'text-gray-600 dark:text-gray-400'
                            }`}
                            style={{ paddingLeft: `${n.indentacao * 12}px` }}
                          >
                            {n.rotulo}
                          </th>
                          <td
                            className={`py-1.5 text-right tabular-nums ${
                              destaque ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {formatarValor(valor, n.unidade)} {n.unidade}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                            {vd === null ? '**' : `${vd}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 text-[10px] leading-relaxed text-gray-500 dark:text-gray-500">
                * Percentual de valores diários com base em uma dieta de 2.000 kcal. Seus valores
                podem ser maiores ou menores conforme suas necessidades energéticas.
                {linhas.some((n) => n.vdr === null) && ' ** Valor diário não estabelecido.'}
              </p>

              {fontes && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  <span>
                    Origem dos dados: {fontes}.{' '}
                    {dados.itens_com_dado === dados.itens_total && dados.itens_total > 0 && (
                      <>Todos os {dados.itens_total} ingredientes da ficha têm dado rastreável.</>
                    )}
                  </span>
                </p>
              )}

              <button
                type="button"
                onClick={() => setMetodoAberto((v) => !v)}
                aria-expanded={metodoAberto}
                className="mt-2 text-[11px] font-semibold text-gray-500 underline underline-offset-2 dark:text-gray-400"
              >
                {metodoAberto ? 'Ocultar método de cálculo' : 'Como este valor foi calculado?'}
              </button>

              {observacaoLoja && (
                <p className="mt-2 rounded-lg bg-gray-50 px-2 py-1.5 text-[10px] leading-relaxed text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                  {observacaoLoja}
                </p>
              )}

              {metodoAberto ? (
                <div className="mt-1.5 space-y-1.5 rounded-xl bg-gray-50 p-2.5 text-[10px] leading-relaxed text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                  {DISCLAIMER_LONGO.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-500">
                  {DISCLAIMER_CURTO}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Flame } from 'lucide-react';
import type { ItemCarrinho } from '../../types';
import {
  formatarValor,
  percentualVD,
  somarNutrientes,
  unirAlergenos,
  type NutricaoOpcao,
  type NutricaoProduto,
  type NutrienteCatalogo,
} from '../../lib/nutricao';

/**
 * O pedido inteiro, somado.
 *
 * A tabela do prato responde "o que é este lanche"; esta responde "o que eu
 * estou levando". São perguntas diferentes, e a segunda é a que aparece na
 * hora de fechar.
 *
 * Honestidade obrigatória: itens sem dado ficam de fora do total e o
 * componente diz quantos foram — um total que finge estar completo é pior do
 * que não ter total.
 */
export default function ResumoNutricionalPedido({
  carrinho,
  nutricao,
  nutricaoOpcoes,
  catalogo,
}: {
  carrinho: ItemCarrinho[];
  nutricao: Map<string, NutricaoProduto>;
  nutricaoOpcoes: Map<string, NutricaoOpcao>;
  catalogo: NutrienteCatalogo[];
}) {
  const [aberto, setAberto] = useState(false);

  const resumo = useMemo(() => {
    let comDado = 0;
    let semDado = 0;
    const parcelas: Array<Record<string, number>> = [];
    const alergenos: Array<{ contem: string[]; pode: string[] }> = [];

    for (const item of carrinho) {
      const n = nutricao.get(item.produto.id);
      const qtd = item.produto.tipo_venda === 'POR_PESO' ? 1 : item.quantidade;

      if (!n || !n.publicavel) {
        semDado += 1;
        // Alérgeno vale mesmo sem número: o item pode não ter caloria
        // calculada e ainda assim conter leite.
        if (n) alergenos.push({ contem: n.alergenos_contem ?? [], pode: n.alergenos_pode_conter ?? [] });
        continue;
      }

      comDado += 1;
      const extras = (item.opcoesSelecionadas ?? [])
        .map((o) => nutricaoOpcoes.get(o.id))
        .filter((x): x is NutricaoOpcao => !!x);

      const doItem = somarNutrientes(n.por_porcao ?? {}, extras.map((e) => e.nutrientes));
      parcelas.push(Object.fromEntries(Object.entries(doItem).map(([k, v]) => [k, v * qtd])));

      alergenos.push({ contem: n.alergenos_contem ?? [], pode: n.alergenos_pode_conter ?? [] });
      extras.forEach((e) =>
        alergenos.push({ contem: e.alergenos_contem ?? [], pode: e.alergenos_pode_conter ?? [] }),
      );
    }

    return {
      total: somarNutrientes({}, parcelas),
      alergenos: unirAlergenos(alergenos),
      comDado,
      semDado,
    };
  }, [carrinho, nutricao, nutricaoOpcoes]);

  const kcal = resumo.total.ENERGIA_KCAL;
  const temAlgo = Number.isFinite(kcal) || resumo.alergenos.contem.length > 0;
  if (!carrinho.length || !temAlgo) return null;

  const principais = catalogo.filter(
    (n) => n.indentacao === 0 && n.codigo !== 'ENERGIA_KCAL' && Number.isFinite(resumo.total[n.codigo]),
  );

  return (
    <section
      aria-label="Resumo nutricional do pedido"
      className="mt-3 rounded-2xl border p-3"
      style={{ borderColor: 'var(--cor-borda)', background: 'var(--cor-surface-muted)' }}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold" style={{ color: 'var(--cor-texto)' }}>
            Neste pedido
          </span>
          {Number.isFinite(kcal) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-black text-white dark:bg-gray-100 dark:text-gray-900">
              <Flame size={10} strokeWidth={3} />
              {formatarValor(kcal, 'kcal')} kcal
            </span>
          )}
          {resumo.alergenos.contem.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle size={10} strokeWidth={3} />
              {resumo.alergenos.contem.length} alergênicos
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
          style={{ color: 'var(--cor-texto-fraco)' }}
        />
      </button>

      {aberto && (
        <div className="mt-2 space-y-2">
          {principais.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              {principais.map((n) => {
                const vd = percentualVD(resumo.total[n.codigo], n.vdr);
                return (
                  <div key={n.codigo} className="flex items-baseline justify-between gap-2">
                    <dt style={{ color: 'var(--cor-texto-suave)' }}>{n.abreviacao ?? n.rotulo}</dt>
                    <dd className="tabular-nums font-semibold" style={{ color: 'var(--cor-texto)' }}>
                      {formatarValor(resumo.total[n.codigo], n.unidade)} {n.unidade}
                      {vd !== null && (
                        <span className="ml-1 font-normal" style={{ color: 'var(--cor-texto-fraco)' }}>
                          ({vd}%)
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}

          {resumo.alergenos.contem.length > 0 && (
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--cor-texto-suave)' }}>
              <strong className="font-bold">Contém:</strong> {resumo.alergenos.contem.join(', ')}.
              {resumo.alergenos.pode.length > 0 && ` Pode conter: ${resumo.alergenos.pode.join(', ')}.`}
            </p>
          )}

          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--cor-texto-fraco)' }}>
            {resumo.semDado > 0
              ? `${resumo.semDado} ${resumo.semDado === 1 ? 'item ainda não tem' : 'itens ainda não têm'} valores calculados e ${resumo.semDado === 1 ? 'ficou' : 'ficaram'} de fora desta soma. `
              : ''}
            Percentuais sobre uma dieta de 2.000 kcal. Estimativa a partir das fichas técnicas da loja.
          </p>
        </div>
      )}
    </section>
  );
}

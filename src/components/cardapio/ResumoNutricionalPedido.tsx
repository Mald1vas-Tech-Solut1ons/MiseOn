import { useMemo, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { AlertTriangle, ChevronDown, Flame } from 'lucide-react';
import type { ItemCarrinho } from '../../types';
import {
  avaliarCoberturaNutricao,
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
  const { tDynamic } = useI18n();
  const [aberto, setAberto] = useState(false);

  const resumo = useMemo(() => {
    let comDado = 0;
    let semDado = 0;
    let parciais = 0;
    let adicionaisPendentes = 0;
    const parcelas: Array<Record<string, number>> = [];
    const alergenos: Array<{ contem: string[]; pode: string[] }> = [];

    for (const item of carrinho) {
      const n = nutricao.get(item.produto.id);
      const qtd = item.produto.tipo_venda === 'POR_PESO' ? 1 : item.quantidade;
      const escolhas = item.opcoesSelecionadas ?? [];
      const extras = escolhas.map((o) => nutricaoOpcoes.get(o.id))
        .filter((x): x is NutricaoOpcao => !!x);
      const cobertura = avaliarCoberturaNutricao(n, extras, escolhas.length);
      adicionaisPendentes += cobertura.adicionaisPendentes;

      // Alergênicos conhecidos são independentes da publicação de calorias.
      // Um extra com leite não pode desaparecer porque a base está pendente.
      if (n) alergenos.push({ contem: n.alergenos_contem ?? [], pode: n.alergenos_pode_conter ?? [] });
      extras.forEach((e) =>
        alergenos.push({ contem: e.alergenos_contem ?? [], pode: e.alergenos_pode_conter ?? [] }),
      );

      if (!n || !n.publicavel) {
        semDado += 1;
        continue;
      }

      comDado += 1;
      if (!cobertura.baseCompleta) parciais += 1;

      const doItem = somarNutrientes(n.por_porcao ?? {}, extras.map((e) => e.nutrientes));
      parcelas.push(Object.fromEntries(Object.entries(doItem).map(([k, v]) => [k, v * qtd])));

    }

    return {
      total: somarNutrientes({}, parcelas),
      alergenos: unirAlergenos(alergenos),
      comDado,
      semDado,
      parciais,
      adicionaisPendentes,
    };
  }, [carrinho, nutricao, nutricaoOpcoes]);

  const kcal = resumo.total.ENERGIA_KCAL;
  const temAlergeno = resumo.alergenos.contem.length > 0 || resumo.alergenos.pode.length > 0;
  const temAlgo = Object.values(resumo.total).some(Number.isFinite) || temAlergeno;
  const parcial = resumo.semDado > 0 || resumo.parciais > 0 || resumo.adicionaisPendentes > 0;
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
          <span className="text-xs opacity-95 font-bold" style={{ color: 'var(--cor-texto)' }}>
            Neste pedido
          </span>
          {Number.isFinite(kcal) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-xs opacity-90 font-black text-white dark:bg-gray-100 dark:text-gray-900">
              <Flame size={10} strokeWidth={3} />
              {formatarValor(kcal, 'kcal')} kcal
            </span>
          )}
          {temAlergeno && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs opacity-90 font-bold text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle size={10} strokeWidth={3} />
              {tDynamic('Alergênicos informados')}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
          style={{ color: 'var(--cor-texto-fraco)' }}
        />
      </button>

      {parcial && (
        <div role="status" className="mt-2 rounded-lg bg-amber-50 p-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <p className="flex items-center gap-1 font-bold"><AlertTriangle size={12} /> Resumo nutricional parcial</p>
          {resumo.semDado > 0 && <p>{resumo.semDado} {resumo.semDado === 1 ? 'item sem valores disponíveis ficou' : 'itens sem valores disponíveis ficaram'} fora da soma.</p>}
          {resumo.parciais > 0 && <p>{resumo.parciais} {resumo.parciais === 1 ? 'receita tem' : 'receitas têm'} cobertura nutricional parcial.</p>}
          {resumo.adicionaisPendentes > 0 && <p>{resumo.adicionaisPendentes} {resumo.adicionaisPendentes === 1 ? 'adicional escolhido ainda não tem dados completos' : 'adicionais escolhidos ainda não têm dados completos'}.</p>}
          <p>{tDynamic('Os valores somam somente os dados conhecidos.')}</p>
        </div>
      )}

      {temAlergeno && (
        <p className="mt-2 text-xs opacity-95 leading-relaxed" style={{ color: 'var(--cor-texto-suave)' }}>
          {resumo.alergenos.contem.length > 0 && <><strong className="font-bold">Contém:</strong> {resumo.alergenos.contem.join(', ')}. </>}
          {resumo.alergenos.pode.length > 0 && <><strong className="font-bold">Pode conter:</strong> {resumo.alergenos.pode.join(', ')}. </>}
          A lista informa o que foi avaliado; ausência na lista não garante ausência no prato.
        </p>
      )}

      {aberto && (
        <div className="mt-2 space-y-2">
          {principais.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs opacity-95">
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

          <p className="text-xs opacity-90 leading-relaxed" style={{ color: 'var(--cor-texto-fraco)' }}>
            {tDynamic('Percentuais sobre uma dieta de 2.000 kcal. Estimativa a partir das fichas técnicas da loja.')}
          </p>
        </div>
      )}
    </section>
  );
}

import type { Categoria, Loja, Produto } from '../types';
import type { NutricaoProduto } from './nutricao';

/**
 * JSON-LD do cardápio, com `NutritionInformation` por prato (NUT-25).
 *
 * Limite conhecido, dito aqui para ninguém se enganar depois: hoje a rota
 * `/:slug` é servida pelo app shell da SPA, que sai com `noindex` do
 * prerender (scripts/prerender.mjs). Ou seja, este bloco só terá efeito de
 * busca quando o cardápio ganhar prerender por loja. Até lá ele serve a
 * crawlers que executam JS e deixa a estrutura pronta — é barato e correto.
 */
export function montarJsonLdCardapio(
  loja: Loja,
  categorias: Categoria[],
  produtos: Produto[],
  nutricao: Map<string, NutricaoProduto>,
): Record<string, unknown> {
  const secoes = categorias
    .map((c) => {
      const itens = produtos
        .filter((p) => p.categoria_id === c.id && p.disponivel)
        .map((p) => {
          const n = nutricao.get(p.id);
          const item: Record<string, unknown> = {
            '@type': 'MenuItem',
            name: p.nome,
            ...(p.descricao ? { description: p.descricao } : {}),
            offers: { '@type': 'Offer', price: Number(p.preco).toFixed(2), priceCurrency: 'BRL' },
          };

          if (n?.publicavel && n.por_porcao) {
            const v = n.por_porcao;
            const g = (codigo: string, sufixo: string) =>
              Number.isFinite(v[codigo]) ? `${Math.round(v[codigo] * 10) / 10} ${sufixo}` : undefined;

            item.nutrition = limpar({
              '@type': 'NutritionInformation',
              servingSize: n.peso_porcao_g ? `${Math.round(n.peso_porcao_g)} g` : undefined,
              calories: Number.isFinite(v.ENERGIA_KCAL) ? `${Math.round(v.ENERGIA_KCAL)} calories` : undefined,
              proteinContent: g('PROTEINAS', 'g'),
              carbohydrateContent: g('CARBOIDRATOS', 'g'),
              sugarContent: g('ACUCARES_TOTAIS', 'g'),
              fatContent: g('GORDURAS_TOTAIS', 'g'),
              saturatedFatContent: g('GORDURAS_SATURADAS', 'g'),
              transFatContent: g('GORDURAS_TRANS', 'g'),
              fiberContent: g('FIBRAS_ALIMENTARES', 'g'),
              cholesterolContent: g('COLESTEROL', 'mg'),
              sodiumContent: g('SODIO', 'mg'),
            });
          }

          // schema.org não tem campo de alergênico; `suitableForDiet` seria
          // afirmação de ausência, e ausência é justamente o que não podemos
          // afirmar (ADR-03). Vai como texto descritivo, sem prometer nada.
          if (n?.alergenos_contem?.length) {
            item.description = `${item.description ? `${item.description} ` : ''}Contém: ${n.alergenos_contem.join(', ')}.`;
          }

          return item;
        });

      return itens.length ? { '@type': 'MenuSection', name: c.nome, hasMenuItem: itens } : null;
    })
    .filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: loja.nome,
    ...(loja.descricao ? { description: loja.descricao } : {}),
    ...(loja.endereco ? { address: loja.endereco } : {}),
    ...(loja.telefone ? { telephone: loja.telefone } : {}),
    ...(loja.logo_url ? { image: loja.logo_url } : {}),
    servesCuisine: 'Brasileira',
    hasMenu: { '@type': 'Menu', name: `Cardápio ${loja.nome}`, hasMenuSection: secoes },
  };
}

function limpar<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

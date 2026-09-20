/**
 * VisualizadorCaminho — Renderiza o grafo de conversão de um insumo
 * de forma linear e pedagógica, mostrando:
 *
 *   [Compra] ──mult──▶ [Armazenado] ──mult──▶ [Uso]
 *    R$ custo           R$ custo/un             R$ custo/un
 *    Física              Humana ⚠️
 *
 * Cada etapa exibe:
 *  - Unidade de origem e destino
 *  - Multiplicador declarado
 *  - Custo unitário acumulado até aquela etapa
 *  - Tipo da aresta: FÍSICA (imutável) ou HUMANA (declarada por item)
 *
 * O componente é zero-latência: opera sobre os dados já carregados
 * (ItemEstoque), sem chamadas de rede adicionais.
 */

import { useMemo } from 'react';
import { Atom, UserRound, TriangleAlert } from 'lucide-react';
import { resolverFator, type ItemEstoque, ErroCusteio } from '../../lib/custeio';
import { getUnidade } from '../../lib/unidades';
import './VisualizadorCaminho.css';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

type TipoAresta = 'fisica' | 'humana';

interface Etapa {
  de: string;
  para: string;
  multiplicador: number;
  tipo: TipoAresta;
  custoUnitario: number | null; // custo nesta unidade (R$/unidade)
}

interface PropsVisualizadorCaminho {
  item: ItemEstoque;
  /** Unidade de origem (compra). Ex.: 'cx', 'kg'. */
  unidadeOrigem: string;
  /** Unidade de uso final. Ex.: 'fatias', 'ml'. */
  unidadeDestino: string;
  /** Custo unitário na unidade base (para calcular custo por etapa). */
  custoUnitarioBase: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determina o tipo de aresta com base nas grandezas das unidades. */
function tipoAresta(de: string, para: string): TipoAresta {
  const uDe = getUnidade(de);
  const uPara = getUnidade(para);
  // Física: ambas dimensionais (kg↔g, L↔ml) da mesma grandeza
  if (
    uDe?.fatorBase != null &&
    uPara?.fatorBase != null &&
    uDe.grandeza === uPara.grandeza
  ) {
    return 'fisica';
  }
  return 'humana';
}

/** Formata um número em Real Brasileiro. */
const brl = (v: number, casas = 4) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: casas,
  });

/** Formata multiplicador para exibição compacta. */
const fmtMult = (m: number) =>
  m >= 1
    ? `×${m.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
    : `÷${(1 / m).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function VisualizadorCaminho({
  item,
  unidadeOrigem,
  unidadeDestino,
  custoUnitarioBase,
  className = '',
}: PropsVisualizadorCaminho) {
  const { etapas, erro } = useMemo(() => {
    try {
      // Reconstrói as etapas percorrendo os fatores do item
      const seq: Etapa[] = [];
      const percorridos = new Set<string>();
      let atual = unidadeOrigem;

      // Índice: de → fator
      const porOrigem = new Map(item.fatores.map((f) => [f.de, f]));

      // Adiciona arestas universais implícitas (kg→g, L→ml)
      const universais: typeof item.fatores = [];
      if (['kg', 'g'].includes(atual) && !porOrigem.has(atual)) {
        universais.push({ de: 'kg', para: 'g', multiplicador: 1000 });
        universais.push({ de: 'g', para: 'kg', multiplicador: 0.001 });
      }
      if (['L', 'ml'].includes(atual)) {
        universais.push({ de: 'L', para: 'ml', multiplicador: 1000 });
        universais.push({ de: 'ml', para: 'L', multiplicador: 0.001 });
      }
      const todosFatores = [...item.fatores, ...universais];
      const porOrigemFull = new Map(todosFatores.map((f) => [f.de, f]));

      while (atual !== unidadeDestino && !percorridos.has(atual)) {
        percorridos.add(atual);
        const fator = porOrigemFull.get(atual);
        if (!fator) break;

        // Custo nesta unidade: custo base × fator para chegar aqui
        let custoNaEtapa: number | null = null;
        try {
          const fatorBase = resolverFator(item, item.unidadeBase, fator.para);
          custoNaEtapa = fatorBase > 0 ? custoUnitarioBase / fatorBase : null;
        } catch {
          custoNaEtapa = null;
        }

        seq.push({
          de: fator.de,
          para: fator.para,
          multiplicador: fator.multiplicador,
          tipo: tipoAresta(fator.de, fator.para),
          custoUnitario: custoNaEtapa,
        });
        atual = fator.para;
      }

      if (seq.length === 0 && unidadeOrigem !== unidadeDestino) {
        return { etapas: [], erro: `Sem caminho de "${unidadeOrigem}" para "${unidadeDestino}".` };
      }
      return { etapas: seq, erro: null };
    } catch (e) {
      return {
        etapas: [],
        erro: e instanceof ErroCusteio ? e.message : 'Erro ao calcular caminho.',
      };
    }
  }, [item, unidadeOrigem, unidadeDestino, custoUnitarioBase]);

  if (erro) {
    return (
      <div className={`vcp-raiz vcp-erro ${className}`} role="alert">
        <span className="vcp-icone-erro"><TriangleAlert size={15} aria-hidden="true" /></span>
        <span>{erro}</span>
      </div>
    );
  }

  // Caso trivial: origem = destino (sem transformação)
  if (etapas.length === 0) {
    return (
      <div className={`vcp-raiz ${className}`}>
        <div className="vcp-no vcp-no-origem">
          <span className="vcp-unidade">{unidadeOrigem}</span>
          <span className="vcp-custo">
            {custoUnitarioBase > 0 ? brl(custoUnitarioBase) + `/${unidadeOrigem}` : '—'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`vcp-raiz ${className}`} role="img" aria-label={`Caminho de conversão de ${unidadeOrigem} para ${unidadeDestino}`}>
      {/* Nó inicial (compra) */}
      <div className="vcp-no vcp-no-origem">
        <span className="vcp-tipo-label">Compra</span>
        <span className="vcp-unidade">{unidadeOrigem}</span>
      </div>

      {etapas.map((etapa, i) => (
        <div key={`${etapa.de}->${etapa.para}`} className="vcp-segmento">
          {/* Seta com multiplicador e tipo */}
          <div className={`vcp-aresta vcp-aresta-${etapa.tipo}`}>
            <span className="vcp-mult">{fmtMult(etapa.multiplicador)}</span>
            <div className="vcp-linha-aresta" />
            <span className={`vcp-tipo-badge vcp-tipo-badge-${etapa.tipo} inline-flex items-center gap-1`}>
              {etapa.tipo === 'fisica'
                ? <><Atom size={12} aria-hidden="true" /> Física</>
                : <><UserRound size={12} aria-hidden="true" /> Humana</>}
            </span>
          </div>

          {/* Nó destino */}
          <div className={`vcp-no ${i === etapas.length - 1 ? 'vcp-no-destino' : 'vcp-no-intermediario'}`}>
            <span className="vcp-tipo-label">
              {i === etapas.length - 1 ? 'Uso' : 'Intermediário'}
            </span>
            <span className="vcp-unidade">{etapa.para}</span>
            {etapa.custoUnitario != null && (
              <span className="vcp-custo">
                {brl(etapa.custoUnitario)}/{etapa.para}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default VisualizadorCaminho;

/**
 * CostGraph3D — wrapper React da engine Three.js do Grafo de Transformação.
 *
 * Responsabilidades (a engine cuida do WebGL; o React cuida do DOM):
 *  - Monta/desmonta a `CostGraphEngine` no ciclo de vida do componente,
 *    garantindo o `dispose()` (sem memory leak) ao desmontar.
 *  - Recebe o grafo já construído OU as compras cruas (constrói aqui).
 *  - Renderiza a LABEL HTML sobreposta seguindo o mouse no hover, e um
 *    painel de detalhe fixo ao selecionar um nó (clique) — a "rota do custo".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { CostGraphEngine, type InfoHover } from './CostGraphEngine';
import { construirGrafoCusto, descreverRotaCusto } from './types';
import type { CompraInput, GrafoCusto, NoCusto } from './types';
import './CostGraph3D.css';

import { useI18n } from '../../contexts/I18nContext';
interface PropsBase {
  /** Altura do canvas (o pai controla a largura). Default 520px. */
  altura?: number | string;
  corFundo?: number;
  onSelecionar?: (no: NoCusto) => void;
}

type Props =
  | (PropsBase & { grafo: GrafoCusto; compras?: never })
  | (PropsBase & { compras: CompraInput[]; grafo?: never });

const brl = (v: number, casas = 2) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: casas,
  });

const ROTULO_TIPO: Record<NoCusto['tipo'], string> = {
  compra: 'Compra',
  conversao: 'Conversão',
  producao: 'Produção',
};

export function CostGraph3D(props: Props) {
  const { tDynamic } = useI18n();
  const { altura = 520, corFundo, onSelecionar } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CostGraphEngine | null>(null);

  const [hover, setHover] = useState<InfoHover | null>(null);
  const [selecionado, setSelecionado] = useState<NoCusto | null>(null);

  // Constrói o grafo uma vez a partir das compras (ou usa o já pronto).
  // Envolto em try/catch: uma violação de conservação vira mensagem visível
  // em vez de derrubar a árvore de componentes.
  const { grafo, erro } = useMemo(() => {
    try {
      if ('grafo' in props && props.grafo) return { grafo: props.grafo, erro: null };
      return { grafo: construirGrafoCusto(props.compras!), erro: null };
    } catch (e) {
      return { grafo: null, erro: e instanceof Error ? e.message : String(e) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(props as { grafo?: GrafoCusto }).grafo, (props as { compras?: CompraInput[] }).compras]);

  // Monta a engine uma única vez (o container não muda de identidade).
  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new CostGraphEngine(containerRef.current, {
      corFundo,
      onHover: setHover,
      onSelect: (no) => {
        setSelecionado(no);
        onSelecionar?.(no);
      },
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Injeta/atualiza os dados sempre que o grafo mudar.
  useEffect(() => {
    if (grafo && engineRef.current) engineRef.current.setData(grafo);
  }, [grafo]);

  // Converte as coords de viewport (clientX/Y) da label para coords relativas
  // ao container — assim a label funciona mesmo com scroll/transform no pai.
  const posLabel = (() => {
    if (!hover || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return { left: hover.telaX - rect.left, top: hover.telaY - rect.top };
  })();

  if (erro) {
    return (
      <div className="mo-cg3d-erro" style={{ height: altura }}>
        <strong>{tDynamic('Grafo bloqueado pela conservação de valor')}</strong>
        <span>{erro}</span>
      </div>
    );
  }

  return (
    <div className="mo-cg3d" style={{ height: altura }}>
      <div ref={containerRef} className="mo-cg3d-canvas" />

      {/* Label HTML sobreposta que segue o mouse no hover */}
      {hover && posLabel && (
        <div
          className="mo-cg3d-tooltip"
          style={{ left: posLabel.left, top: posLabel.top }}
          role="tooltip"
        >
          {descreverRotaCusto(hover.no)}
        </div>
      )}

      {/* Legenda da escala de calor */}
      <div className="mo-cg3d-legenda">
        <span>barato</span>
        <i className="mo-cg3d-gradiente" />
        <span>caro / un</span>
      </div>

      {/* Painel de detalhe da fração selecionada (clique) */}
      {selecionado && (
        <aside className="mo-cg3d-painel">
          <header>
            <div className="flex items-center gap-1.5">
              <span className="mo-cg3d-badge">{ROTULO_TIPO[selecionado.tipo]}</span>
              {selecionado.categoria && (
                <span className="text-xs opacity-90 bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-bold uppercase">
                  {selecionado.categoria}
                </span>
              )}
            </div>
            <button
              className="mo-cg3d-fechar"
              onClick={() => setSelecionado(null)}
              aria-label="Fechar"
            >
              ×
            </button>
          </header>
          <h4>{selecionado.rotulo}</h4>
          <dl>
            <div>
              <dt>{tDynamic('Proporção do Fracionamento')}</dt>
              <dd className="w-full">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-blue-400">
                    {selecionado.profundidade === 0 ? 'Lote Raiz (100%)' : `${selecionado.proporcaoPaiPct}% do Custo Pai`}
                  </span>
                  <span className="text-xs opacity-90 text-gray-400">Nível {selecionado.profundidade}</span>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(Math.max(selecionado.proporcaoPaiPct, 2), 100)}%` }}
                  />
                </div>
              </dd>
            </div>
            <div>
              <dt>{tDynamic('Ordem de Grandeza')}</dt>
              <dd className="font-bold text-purple-300">
                10<sup>{selecionado.ordemGrandeza}</sup> R$/un <span className="text-xs opacity-90 font-normal text-gray-400">({selecionado.ordemGrandeza >= 0 ? `~R$ 10^${selecionado.ordemGrandeza}` : `~R$ 10^(${selecionado.ordemGrandeza})`})</span>
              </dd>
            </div>
            <div>
              <dt>{tDynamic('Volume em Estoque')}</dt>
              <dd className="font-bold text-blue-400">
                {selecionado.quantidade} {selecionado.unidade}
              </dd>
            </div>
            <div>
              <dt>{tDynamic('Densidade de Custo')}</dt>
              <dd className="font-black text-emerald-400">
                {brl(selecionado.custoUnitario, 4)}/{selecionado.unidade}
              </dd>
            </div>
            <div>
              <dt>Capital Imobilizado</dt>
              <dd className="font-black text-amber-300">{brl(selecionado.custoAlocado)}</dd>
            </div>
            {selecionado.custoConsumidoPelosFilhos > 0 && (
              <div>
                <dt>{tDynamic('Fracionado p/ Produção')}</dt>
                <dd className="text-purple-300 font-semibold">{brl(selecionado.custoConsumidoPelosFilhos)}</dd>
              </div>
            )}
            <div>
              <dt>{tDynamic('Origem Rastreável')}</dt>
              <dd className="text-gray-400 text-xs">Lote #{selecionado.compraOrigemId.slice(0, 8)}</dd>
            </div>
          </dl>
        </aside>
      )}
    </div>
  );
}

export default CostGraph3D;

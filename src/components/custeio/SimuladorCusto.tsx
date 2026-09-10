/**
 * SimuladorCusto — Simulador de custo em tempo real para o lojista.
 *
 * Exibe ao vivo, enquanto o lojista define o rendimento de um insumo:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ 📦 Custo atual no estoque (PEPS)         R$ 0,006 / ml      │
 *   │ 🛒 Custo estimado próxima compra          R$ 0,005 / ml      │
 *   │ 📐 Custo por uso (200 ml)                 R$ 1,20            │
 *   │ 📊 Impacto no CMV da receita              R$ 3,45 → R$ 4,65  │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Zero latência: usa custoDeUso() local para todos os cálculos de UI.
 * Para persistência, use calcularCustoBOM() do custeio-service.
 */

import { useMemo, useState } from 'react';
import {
  custoDeUso,
  custoUnitarioBase,
  custoBOM,
  type ItemEstoque,
  type MetodoCusteio,
  type LinhaBOM,
} from '../../lib/custeio';
import { VisualizadorCaminho } from './VisualizadorCaminho';
import './SimuladorCusto.css';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface LinhaBOMSimulador extends LinhaBOM {
  nomeItem?: string;
}

interface PropsSimuladorCusto {
  /** Item principal sendo configurado. */
  item: ItemEstoque;
  /** Unidade de compra do item (ponto de entrada na cadeia). */
  unidadeOrigem: string;
  /** Custo estimado do cadastro (preco_embalagem / qtd_embalagem). */
  custoEstimado?: number;
  /** Receita (BOM) atual para calcular impacto no custo total. */
  receita?: LinhaBOMSimulador[];
  /** Mapa de todos os itens da receita (necessário para custoBOM). */
  itensReceita?: Map<string, ItemEstoque>;
  metodo?: MetodoCusteio;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const brl = (v: number | null | undefined, casas = 4): string => {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: casas,
  });
};

const pct = (v: number | null): string => {
  if (v == null || !Number.isFinite(v)) return '—';
  const sinal = v > 0 ? '+' : '';
  return `${sinal}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
};

// ---------------------------------------------------------------------------
// Sub-componente: Card de métrica
// ---------------------------------------------------------------------------

function CardMetrica({
  icone,
  titulo,
  valor,
  sub,
  alerta,
  destaque,
}: {
  icone: string;
  titulo: string;
  valor: string;
  sub?: string;
  alerta?: boolean;
  destaque?: boolean;
}) {
  return (
    <div className={`sc-card ${alerta ? 'sc-card-alerta' : ''} ${destaque ? 'sc-card-destaque' : ''}`}>
      <span className="sc-icone">{icone}</span>
      <div className="sc-corpo">
        <span className="sc-titulo">{titulo}</span>
        <span className="sc-valor">{valor}</span>
        {sub && <span className="sc-sub">{sub}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function SimuladorCusto({
  item,
  unidadeOrigem,
  custoEstimado,
  receita,
  itensReceita,
  metodo = 'PEPS',
  className = '',
}: PropsSimuladorCusto) {
  const [mostrarCaminho, setMostrarCaminho] = useState(false);

  const metricas = useMemo(() => {
    let custoPEPS: number | null = null;
    let custoMedio: number | null = null;
    let custoPorUso: number | null = null;
    let custoBomAntes: number | null = null;
    let custoBomDepois: number | null = null;

    try {
      // Custo na unidade BASE via PEPS e Médio
      custoPEPS  = custoUnitarioBase(item, 'PEPS');
      custoMedio = custoUnitarioBase(item, 'MEDIO');
    } catch {
      // Sem lotes — custo indefinido
    }

    // Custo de uso na unidade de destino (final da cadeia)
    if (item.lotes.some((l) => l.quantidade > 0) && item.unidadeBase) {
      try {
        // Custo de 1 unidade base na cadeia de destino
        custoPorUso = custoDeUso(item, 1, item.unidadeBase, metodo);
      } catch {
        custoPorUso = null;
      }
    }

    // Impacto no BOM (antes e depois de configurar o item)
    if (receita?.length && itensReceita) {
      try {
        const linhasBOM: LinhaBOM[] = receita.map((l) => ({
          itemId: l.itemId,
          quantidade: l.quantidade,
          unidade: l.unidade,
        }));
        custoBomDepois = custoBOM(linhasBOM, itensReceita, metodo).total;
        // "Antes" = BOM sem o item sendo configurado (para mostrar impacto marginal)
        const semItem = linhasBOM.filter((l) => l.itemId !== item.id);
        if (semItem.length > 0) {
          const itensRestantes = new Map(
            [...(itensReceita ?? new Map())].filter(([k]) => k !== item.id),
          );
          custoBomAntes = semItem.length > 0
            ? custoBOM(semItem, itensRestantes, metodo).total
            : null;
        }
      } catch {
        custoBomDepois = null;
      }
    }

    return { custoPEPS, custoMedio, custoPorUso, custoBomAntes, custoBomDepois };
  }, [item, metodo, receita, itensReceita]);

  // Desvio estimado vs real
  const desvio = useMemo(() => {
    if (!custoEstimado || !metricas.custoPEPS || metricas.custoPEPS <= 0) return null;
    return ((custoEstimado - metricas.custoPEPS) / metricas.custoPEPS) * 100;
  }, [custoEstimado, metricas.custoPEPS]);

  const unidadeDestino = useMemo(() => {
    // Encontra a unidade final da cadeia (último destino dos fatores)
    const destinos = new Set(item.fatores.map((f) => f.para));
    const partidas = new Set(item.fatores.map((f) => f.de));
    const folha = [...destinos].find((d) => !partidas.has(d));
    return folha ?? item.unidadeBase;
  }, [item]);

  const temLotes = item.lotes.some((l) => l.quantidade > 0);

  return (
    <div className={`sc-raiz ${className}`} aria-label="Simulador de custo em tempo real">
      {/* Cabeçalho */}
      <div className="sc-header">
        <div className="sc-header-texto">
          <span className="sc-titulo-principal">📊 Simulador de Custo</span>
          <span className="sc-subtitulo">{item.nome} · {metodo}</span>
        </div>
        <button type="button"
          className="sc-btn-caminho"
          onClick={() => setMostrarCaminho((v) => !v)}
          aria-expanded={mostrarCaminho}
        >
          {mostrarCaminho ? 'Ocultar' : 'Ver'} caminho de conversão
        </button>
      </div>

      {/* Visualizador de caminho (expansível) */}
      {mostrarCaminho && (
        <div className="sc-caminho-wrapper">
          <VisualizadorCaminho
            item={item}
            unidadeOrigem={unidadeOrigem}
            unidadeDestino={unidadeDestino}
            custoUnitarioBase={metricas.custoPEPS ?? 0}
          />
        </div>
      )}

      {/* Grade de métricas */}
      <div className="sc-grade">
        <CardMetrica
          icone="📦"
          titulo={`Custo PEPS (${item.unidadeBase})`}
          valor={temLotes ? brl(metricas.custoPEPS) + `/${item.unidadeBase}` : '—'}
          sub={temLotes ? `Médio: ${brl(metricas.custoMedio)}/${item.unidadeBase}` : 'Sem lotes em estoque'}
          alerta={!temLotes}
        />

        {custoEstimado != null && (
          <CardMetrica
            icone="🛒"
            titulo="Custo estimado cadastro"
            valor={brl(custoEstimado) + `/${item.unidadeBase}`}
            sub={desvio != null
              ? `Desvio vs PEPS: ${pct(desvio)}`
              : undefined}
            alerta={desvio != null && Math.abs(desvio) >= 15}
          />
        )}

        {unidadeDestino !== item.unidadeBase && (
          <CardMetrica
            icone="📐"
            titulo={`Custo por ${unidadeDestino}`}
            valor={metricas.custoPorUso != null
              ? brl(custoDeUso(item, 1, unidadeDestino, metodo)) + `/${unidadeDestino}`
              : '—'}
            sub={`Base: ${item.unidadeBase} → ${unidadeDestino}`}
            destaque
          />
        )}

        {metricas.custoBomDepois != null && (
          <CardMetrica
            icone="🍽️"
            titulo="Custo total da receita"
            valor={brl(metricas.custoBomDepois, 2)}
            sub={metricas.custoBomAntes != null
              ? `Impacto deste item: ${brl(metricas.custoBomDepois - metricas.custoBomAntes, 2)}`
              : undefined}
            destaque
          />
        )}
      </div>

      {/* Nota de rodapé sobre o método */}
      <div className="sc-rodape">
        <span className="sc-nota">
          {metodo === 'PEPS'
            ? '⚡ PEPS: usa o custo do lote mais antigo com saldo — reflete o que será baixado na próxima venda.'
            : '⚖️ Médio: pondera todos os lotes com saldo — suaviza variações de preço.'}
        </span>
      </div>
    </div>
  );
}

export default SimuladorCusto;

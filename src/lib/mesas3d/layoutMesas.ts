/**
 * layoutMesas.ts — Calculadora procedural de layout 3D para mesas e assentos.
 */

import type { Mesa, Comanda, Pedido, ItemPedido, FormatoMesa } from '../../types';
import type { Assento3D, Mesa3DPosicionada, StatusMesa3D } from './types';

/** Distância mínima entre centros de mesas no grid padrão (unidades Three.js) */
export const ESPACAMENTO_GRID = 5.5;

/** Raio do tampo da mesa para fins de raycasting e posicionamento dos assentos */
export function obterDimensoesTampo(formato: FormatoMesa, capacidade: number): { largura: number; profundidade: number; raioAssentos: number } {
  switch (formato) {
    case 'REDONDA': {
      const raio = 0.9 + Math.max(0, capacidade - 4) * 0.15;
      return { largura: raio * 2, profundidade: raio * 2, raioAssentos: raio + 0.65 };
    }
    case 'RETANGULAR': {
      const larg = 1.6 + Math.floor(capacidade / 2) * 0.6;
      const prof = 1.1;
      return { largura: larg, profundidade: prof, raioAssentos: Math.max(larg, prof) / 2 + 0.65 };
    }
    case 'BOOTH': {
      return { largura: 2.0, profundidade: 1.4, raioAssentos: 1.3 };
    }
    case 'QUADRADA':
    default: {
      const dim = 1.3 + (capacidade > 4 ? 0.4 : 0);
      return { largura: dim, profundidade: dim, raioAssentos: dim / 2 + 0.65 };
    }
  }
}

/**
 * Calcula a posição trigonométrica de cada assento (cadeira) em relação ao centro da mesa.
 */
export function calcularPosicoesAssentos(formato: FormatoMesa, capacidade: number): { numero: number; xRel: number; zRel: number }[] {
  const cap = Math.max(1, capacidade || 4);
  const resultado: { numero: number; xRel: number; zRel: number }[] = [];
  const dim = obterDimensoesTampo(formato, cap);

  if (formato === 'REDONDA') {
    for (let i = 0; i < cap; i++) {
      const angulo = (i / cap) * Math.PI * 2 - Math.PI / 2;
      resultado.push({
        numero: i + 1,
        xRel: Math.cos(angulo) * dim.raioAssentos,
        zRel: Math.sin(angulo) * dim.raioAssentos,
      });
    }
  } else if (formato === 'RETANGULAR') {
    // Distribuição ao longo das 2 laterais maiores + cabeceiras se necessário
    const assentosPorLado = Math.floor(cap / 2);
    const espacamento = dim.largura / (assentosPorLado + 1);
    let idNum = 1;

    // Lado Norte (-Z)
    for (let i = 0; i < assentosPorLado && idNum <= cap; i++) {
      resultado.push({
        numero: idNum++,
        xRel: -dim.largura / 2 + espacamento * (i + 1),
        zRel: -dim.profundidade / 2 - 0.55,
      });
    }

    // Lado Sul (+Z)
    for (let i = 0; i < assentosPorLado && idNum <= cap; i++) {
      resultado.push({
        numero: idNum++,
        xRel: -dim.largura / 2 + espacamento * (i + 1),
        zRel: dim.profundidade / 2 + 0.55,
      });
    }

    // Sobras nas cabeceiras (Leste +X / Oeste -X)
    if (idNum <= cap) {
      resultado.push({ numero: idNum++, xRel: dim.largura / 2 + 0.55, zRel: 0 });
    }
    if (idNum <= cap) {
      resultado.push({ numero: idNum++, xRel: -dim.largura / 2 - 0.55, zRel: 0 });
    }
  } else {
    // QUADRADA ou BOOTH: Distribuição nos 4 lados
    const raio = dim.raioAssentos;
    for (let i = 0; i < cap; i++) {
      const angulo = (i / cap) * Math.PI * 2 - Math.PI / 2;
      resultado.push({
        numero: i + 1,
        xRel: Math.cos(angulo) * raio,
        zRel: Math.sin(angulo) * raio,
      });
    }
  }

  return resultado;
}

/**
 * Processa a lista crua de mesas do banco de dados e as transforma em objetos posicionados 3D.
 */
export function prepararLayoutSalao3D(
  mesas: Mesa[],
  comandasAbertas: Comanda[],
  pedidosMesas: Pedido[]
): Mesa3DPosicionada[] {
  const comandaPorMesa = new Map<string, Comanda>();
  for (const c of comandasAbertas) {
    if (c.mesa_id) comandaPorMesa.set(c.mesa_id, c);
  }

  const pedidosPorComanda = new Map<string, Pedido[]>();
  for (const p of pedidosMesas) {
    if (!p.comanda_id) continue;
    const lista = pedidosPorComanda.get(p.comanda_id) ?? [];
    lista.push(p);
    pedidosPorComanda.set(p.comanda_id, lista);
  }

  // Ordena mesas pelo número para garantir grid consistente se não houver coords gravadas
  const mesasOrdenadas = [...mesas].sort((a, b) => a.numero - b.numero);
  const totalMesas = mesasOrdenadas.length;
  const colunasGrid = Math.ceil(Math.sqrt(totalMesas * 1.3));

  return mesasOrdenadas.map((mesa, idx) => {
    const comanda = comandaPorMesa.get(mesa.id);
    const pedidos = comanda ? pedidosPorComanda.get(comanda.id) ?? [] : [];

    // Posição X e Z (usa as gravadas ou calcula no grid matricial)
    const col = idx % colunasGrid;
    const lin = Math.floor(idx / colunasGrid);
    const posXAuto = (col - (colunasGrid - 1) / 2) * ESPACAMENTO_GRID;
    const posZAuto = (lin - (Math.ceil(totalMesas / colunasGrid) - 1) / 2) * ESPACAMENTO_GRID;

    const x = mesa.pos_x ?? posXAuto;
    const z = mesa.pos_z ?? posZAuto;
    const rotacao = mesa.rotacao ?? 0;
    const formato: FormatoMesa = mesa.formato ?? 'QUADRADA';
    const capacidade = mesa.capacidade ?? 4;

    // Métricas financeiras e de estado
    let totalParcial = 0;
    let totalPago = 0;
    let temItemEmPreparo = false;
    const todosItensMesa: ItemPedido[] = [];

    for (const p of pedidos) {
      if (p.status === 'CANCELADO') continue;
      totalParcial += Number(p.valor_total);
      totalPago += (p.pagamentos ?? []).reduce((sum, pg) => sum + Number(pg.valor_pago), 0);
      if (['NOVO', 'ACEITO', 'PREPARANDO'].includes(p.status)) temItemEmPreparo = true;
      if (p.itens_pedido) todosItensMesa.push(...p.itens_pedido);
    }

    const saldoDevedor = Math.max(0, totalParcial - totalPago);
    const tempoMinutos = comanda ? Math.floor((Date.now() - new Date(comanda.aberta_em).getTime()) / 60000) : 0;

    // Determina o status visual 3D
    let status3D: StatusMesa3D = 'LIVRE';
    if (comanda) {
      if (temItemEmPreparo) status3D = 'EM_PREPARO';
      else if (saldoDevedor > 0) status3D = 'OCUPADA';
      else status3D = 'AGUARDANDO_CONTA';
    }

    // Estrutura os assentos com itens atrelados
    const posAssentos = calcularPosicoesAssentos(formato, capacidade);
    const assentos: Assento3D[] = posAssentos.map((pos) => {
      const itensDoAssento = todosItensMesa.filter((i) => i.assento_numero === pos.numero);
      const valorConsumido = itensDoAssento.reduce((sum, i) => sum + Number(i.preco_unitario) * i.quantidade, 0);
      return {
        numero: pos.numero,
        xRelativo: pos.xRel,
        zRelativo: pos.zRel,
        ocupado: comanda ? (valorConsumido > 0 || pos.numero <= (pedidos.length > 0 ? Math.min(capacidade, 2) : 1)) : false,
        valorConsumido,
        totalItens: itensDoAssento.reduce((sum, i) => sum + i.quantidade, 0),
        itens: itensDoAssento,
      };
    });

    return {
      mesa,
      comanda,
      status3D,
      assentos,
      x,
      z,
      rotacao,
      formato,
      capacidade,
      totalParcial,
      totalPago,
      saldoDevedor,
      tempoMinutos,
      temItemEmPreparo,
      pedidos,
    };
  });
}

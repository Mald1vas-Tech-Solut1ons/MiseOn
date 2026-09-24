import type { EntregaModo } from '../types';

/** Faixa como a tela edita (strings dos inputs). */
export interface FaixaEntregaForm {
  id?: string;
  nome: string;
  km_ate: string;
  taxa_fixa: string;
  taxa_por_km: string;
  pedido_minimo: string;
  ordem: number;
  ativo: boolean;
}

export interface ConfigEntregaForm {
  aceita_entrega: boolean;
  entrega_modo: EntregaModo;
  entrega_taxa_base: string;
  entrega_taxa_km: string;
  entrega_raio_km: string;
  frete_gratis_valor_minimo: string;
  lat: string;
  lng: string;
}

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/** Faixas ativas e preenchidas, em ordem de distância, no formato do banco. */
export function faixasParaSalvar(faixas: FaixaEntregaForm[], lojaId: string) {
  return faixas
    .filter((f) => f.ativo && num(f.km_ate) != null)
    .sort((a, b) => Number(num(a.km_ate)) - Number(num(b.km_ate)))
    .map((f, i) => ({
      loja_id: lojaId,
      nome: f.nome.trim() || null,
      km_ate: Number(num(f.km_ate)),
      taxa_fixa: num(f.taxa_fixa),
      taxa_por_km: num(f.taxa_fixa) != null ? null : num(f.taxa_por_km),
      pedido_minimo: Number(num(f.pedido_minimo) ?? 0),
      ordem: i + 1,
      ativo: true,
    }));
}

/**
 * O que impede salvar a entrega. Devolve a primeira frase que o lojista
 * precisa ler, ou null. Loja que não entrega não precisa de nada.
 */
export function validarConfigEntrega(c: ConfigEntregaForm, faixas: FaixaEntregaForm[]): string | null {
  if (!c.aceita_entrega) return null;

  if (num(c.lat) == null || num(c.lng) == null) {
    return 'Localize a loja no mapa: é de lá que a distância das entregas é medida.';
  }

  const negativos = [c.entrega_taxa_base, c.entrega_taxa_km, c.entrega_raio_km, c.frete_gratis_valor_minimo]
    .some((v) => (num(v) ?? 0) < 0);
  if (negativos) return 'Valores de entrega não podem ser negativos.';

  if (c.entrega_modo === 'HIBRIDO') {
    const ativas = faixas.filter((f) => f.ativo && (f.km_ate.trim() !== '' || f.taxa_fixa.trim() !== ''));
    if (ativas.length === 0) return 'Cadastre pelo menos uma faixa: até quantos km e quanto cobra.';
    for (const f of ativas) {
      const km = num(f.km_ate);
      if (km == null || !(km > 0)) return 'Toda faixa precisa de uma distância maior que zero.';
      if (num(f.taxa_fixa) == null && num(f.taxa_por_km) == null) return `Informe a taxa da faixa de até ${km} km.`;
      if ((num(f.taxa_fixa) ?? 0) < 0 || (num(f.pedido_minimo) ?? 0) < 0) return 'Valores de entrega não podem ser negativos.';
    }
    const kms = ativas.map((f) => num(f.km_ate));
    if (new Set(kms).size !== kms.length) return 'Duas faixas com a mesma distância: cada faixa precisa de um limite diferente.';
    return null;
  }

  if (!((num(c.entrega_raio_km) ?? 0) > 0)) return 'Informe até quantos km a loja entrega.';
  if (c.entrega_modo === 'FIXA' && num(c.entrega_taxa_base) == null) return 'Informe o valor da taxa única.';
  if (c.entrega_modo === 'DISTANCIA' && num(c.entrega_taxa_km) == null) return 'Informe quanto cobra por km.';
  return null;
}

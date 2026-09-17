/** Cores das fatias das barras das ferramentas — tokens da marca MiseOn. */
export const CORES_FATIA: Record<string, string> = {
  custo: '#FC5B24',
  fixas: '#004198',
  variaveis: '#0A5CC4',
  lucro: '#0E7A4E',
  canal: '#B4232C',
  voce: '#0E7A4E',
  sobra: '#0A5CC4',
};

export interface Segmento {
  rotulo: string;
  valor: string;
  /** Participação no total, de 0 a 100. */
  pct: number;
  cor: string;
}

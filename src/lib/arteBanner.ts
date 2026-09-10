/**
 * ARTE DE BANNER DO SISTEMA — modelos e a leitura honesta do cupom.
 *
 * ─── POR QUE ISTO EXISTE ───────────────────────────────────────────────────
 * Banner precisava de imagem pronta, então o lojista abria o Canva, montava,
 * exportava e subia. Quem não tem designer sobe uma ilustração de banco de
 * imagens — que foi exatamente o que aconteceu na Natureba: arte bonita, zero
 * oferta.
 *
 * Pior: arte feita à mão MENTE com o tempo. O concorrente estampa "use o cupom
 * POSFERIADAOOFF — pedido de qualquer valor". Se alguém editar o cupom e
 * exigir R$ 30 de mínimo, a imagem continua prometendo o contrário. O cliente
 * tenta, o sistema recusa com razão, e quem passa vergonha é a loja.
 *
 * Aqui a arte é DESENHADA a partir dos dados. Quando o banner aponta para um
 * cupom, as condições saem da própria linha de `cupons` — a promessa não tem
 * como divergir da regra, porque as duas nascem da mesma fonte.
 */

export type ModeloArte = 'CUPOM' | 'DESCONTO' | 'FRETE' | 'NOVIDADE' | 'HORARIO' | 'COMBO';

export const MODELOS_ARTE: { id: ModeloArte; nome: string; paraQue: string }[] = [
  { id: 'CUPOM',    nome: 'Cupom em destaque', paraQue: 'O código é o herói. Use quando a promoção depende do cliente digitar algo.' },
  { id: 'DESCONTO', nome: 'Desconto grande',   paraQue: 'O número manda. Para porcentagem ou valor que fala sozinho.' },
  { id: 'FRETE',    nome: 'Frete',             paraQue: 'Entrega grátis ou barata — o argumento que mais tira carrinho abandonado.' },
  { id: 'NOVIDADE', nome: 'Novidade',          paraQue: 'Item novo, sabor da semana, volta de um clássico.' },
  { id: 'HORARIO',  nome: 'Horário',           paraQue: 'Chamada por tempo: happy hour, almoço, últimas horas.' },
  { id: 'COMBO',    nome: 'Combo com preço',   paraQue: 'Duas coisas por um preço. O valor fica em destaque à direita.' },
];

/** O que o banner precisa saber para se desenhar. */
export interface DadosArte {
  modelo: ModeloArte;
  selo?: string | null;
  titulo?: string | null;
  subtitulo?: string | null;
  ctaTexto?: string | null;
  /** Só no modelo CUPOM. */
  codigo?: string | null;
  /** Condições reais do cupom, já em português. */
  condicoes?: string[];
}

/** Uma linha de `cupons`, no que interessa para a arte. */
export interface CupomParaArte {
  codigo: string;
  tipo: 'PERCENTUAL' | 'FIXO' | string;
  valor: number | string;
  pedido_minimo?: number | string | null;
  metodo_exigido?: string | null;
  validade?: string | null;
  apenas_primeiro_pedido?: boolean | null;
  frete_gratis?: boolean | null;
  limite_usos?: number | null;
  usos?: number | null;
  ativo?: boolean | null;
}

function numero(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Data do banco vira data LOCAL, não UTC.
 *
 * `new Date('2026-07-26')` é meia-noite em UTC. No horário do Brasil isso é
 * 21h do dia 25 — e `toLocaleDateString('pt-BR')` imprime "25/07". Um cupom
 * válido até o dia 26 apareceria vencendo no dia 25 para o lojista e para o
 * cliente, com a regra do banco dizendo outra coisa. Data só com dia (sem
 * hora) é uma data de calendário, não um instante: montamos com os componentes
 * locais para o dia impresso ser o dia guardado.
 */
function paraDataLocal(iso: string): Date {
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (soData) {
    return new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]), 23, 59, 59);
  }
  return new Date(iso);
}

/**
 * A chamada do desconto, como o cliente entende: "10% OFF", "R$ 7 OFF",
 * "FRETE GRÁTIS".
 */
export function chamadaDoCupom(cupom: CupomParaArte): string {
  if (cupom.frete_gratis) return 'FRETE GRÁTIS';
  const v = numero(cupom.valor);
  return cupom.tipo === 'FIXO' ? `${moeda(v)} OFF` : `${v.toLocaleString('pt-BR')}% OFF`;
}

/**
 * As condições REAIS do cupom, em frases curtas. Cada uma existe porque é um
 * motivo pelo qual o cliente vai ver "cupom não aplicado" e achar que o
 * sistema quebrou — foi o que aconteceu com um pedido de R$ 7,00 contra um
 * cupom que exige R$ 30.
 *
 * Lista vazia é resposta válida e significa a melhor notícia possível: vale
 * para qualquer pedido. Quem chama decide se estampa "Pedido de qualquer
 * valor" ou nada.
 */
export function condicoesDoCupom(cupom: CupomParaArte, hoje = new Date()): string[] {
  const frases: string[] = [];

  const minimo = numero(cupom.pedido_minimo);
  if (minimo > 0) frases.push(`Pedido a partir de ${moeda(minimo)}`);

  if (cupom.metodo_exigido) {
    const nomes: Record<string, string> = {
      PIX: 'Pix', DINHEIRO: 'dinheiro', CREDITO: 'cartão de crédito', DEBITO: 'cartão de débito',
    };
    frases.push(`Somente no ${nomes[cupom.metodo_exigido] ?? cupom.metodo_exigido.toLowerCase()}`);
  }

  if (cupom.apenas_primeiro_pedido) frases.push('Só no primeiro pedido');

  if (cupom.validade) {
    const fim = paraDataLocal(cupom.validade);
    if (!Number.isNaN(fim.getTime())) {
      // Vencido é informação que o lojista precisa ver ANTES de estampar num
      // banner. Silenciar aqui produziria arte anunciando cupom morto.
      frases.push(
        fim < hoje
          ? `Venceu em ${fim.toLocaleDateString('pt-BR')}`
          : `Válido até ${fim.toLocaleDateString('pt-BR')}`,
      );
    }
  }

  const limite = cupom.limite_usos ?? null;
  if (limite != null && limite > 0) {
    const restantes = limite - numero(cupom.usos);
    frases.push(restantes > 0 ? `Restam ${restantes} usos` : 'Esgotado');
  }

  if (cupom.ativo === false) frases.push('Cupom desativado');

  return frases;
}

/** `true` quando o cupom não vai funcionar hoje, por qualquer motivo. */
export function cupomInvalidoHoje(cupom: CupomParaArte, hoje = new Date()): boolean {
  if (cupom.ativo === false) return true;
  if (cupom.validade) {
    const fim = paraDataLocal(cupom.validade);
    if (!Number.isNaN(fim.getTime()) && fim < hoje) return true;
  }
  const limite = cupom.limite_usos ?? null;
  if (limite != null && limite > 0 && numero(cupom.usos) >= limite) return true;
  return false;
}

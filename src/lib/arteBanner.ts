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
  hora_inicio?: string | null;
  hora_fim?: string | null;
  dias_semana?: number[] | null;
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Hora e dia da semana NA LOJA, não no navegador.
 *
 * O banco decide a janela em `fn_cupom_na_janela`, que converte para
 * 'America/Sao_Paulo' antes de comparar. Se a tela usasse a hora local do
 * navegador, um lojista viajando — ou o runner de E2E, que roda em en-US —
 * veria "fora do horário" num cupom que o servidor está aceitando. Quem
 * mostra e quem decide têm de ler o mesmo relógio.
 */
function relogioDaLoja(agora: Date): { segundos: number; dow: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(agora);
  const p: Record<string, string> = {};
  for (const parte of partes) p[parte.type] = parte.value;
  // hour12:false devolve "24" para a meia-noite em alguns motores.
  const h = Number(p.hour) % 24;
  return {
    segundos: h * 3600 + Number(p.minute) * 60 + Number(p.second),
    dow: new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))).getUTCDay(),
  };
}

/** 'HH:MM' ou 'HH:MM:SS' do Postgres vira segundos desde a meia-noite. */
function horaEmSegundos(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(hora.trim());
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
}

/** 'HH:MM:SS' vira '14h' ou '13h40', que é como o lojista fala. */
function horaCurta(hora: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora.trim());
  if (!m) return hora;
  return m[2] === '00' ? `${Number(m[1])}h` : `${Number(m[1])}h${m[2]}`;
}

/**
 * A janela do cupom em uma frase: "Das 11h às 14h", "A partir das 13h40",
 * "Quinta, das 18h às 20h". `null` quando o cupom vale o tempo todo.
 */
export function janelaDoCupom(cupom: CupomParaArte): string | null {
  const ini = cupom.hora_inicio ? horaCurta(cupom.hora_inicio) : null;
  const fim = cupom.hora_fim ? horaCurta(cupom.hora_fim) : null;
  const dias = cupom.dias_semana?.length
    ? [...cupom.dias_semana].sort((a, b) => a - b).map((d) => DIAS_CURTOS[d]).filter(Boolean).join(', ')
    : null;

  let horario: string | null = null;
  if (ini && fim) horario = `das ${ini} às ${fim}`;
  else if (ini) horario = `a partir das ${ini}`;
  else if (fim) horario = `até as ${fim}`;

  if (horario && dias) return `${dias[0].toUpperCase()}${dias.slice(1)}, ${horario}`;
  if (horario) return `${horario[0].toUpperCase()}${horario.slice(1)}`;
  if (dias) return `Só ${dias}`;
  return null;
}

/**
 * Espelho exato de `fn_cupom_na_janela`. `true` quando o cupom tem janela e o
 * momento está FORA dela.
 *
 * Não é o mesmo que inválido: o cupom do almoço às 9h da manhã está saudável,
 * só não é agora. Quem mistura os dois pinta de vermelho um cupom que está
 * funcionando e faz o lojista "consertar" o que não está quebrado.
 */
export function cupomForaDaJanelaAgora(cupom: CupomParaArte, agora = new Date()): boolean {
  const ini = horaEmSegundos(cupom.hora_inicio);
  const fim = horaEmSegundos(cupom.hora_fim);
  const dias = cupom.dias_semana?.length ? cupom.dias_semana : null;
  if (ini === null && fim === null && !dias) return false;

  const { segundos: hm, dow } = relogioDaLoja(agora);
  const ontem = (dow + 6) % 7;
  const diaOk = (d: number) => !dias || dias.includes(d);

  if (ini === null && fim === null) return !diaOk(dow);
  if (ini === null) return !(hm <= fim! && diaOk(dow));
  if (fim === null) return !(hm >= ini && diaOk(dow));
  if (fim > ini) return !(hm >= ini && hm <= fim && diaOk(dow));
  // Cruza a meia-noite: a madrugada pertence ao dia anterior.
  return !((hm >= ini && diaOk(dow)) || (hm <= fim && diaOk(ontem)));
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

  // A janela entra antes da validade de propósito: é a condição que o cliente
  // esbarra hoje, enquanto a validade só morde no fim do mês.
  const janela = janelaDoCupom(cupom);
  if (janela) frases.push(janela);

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

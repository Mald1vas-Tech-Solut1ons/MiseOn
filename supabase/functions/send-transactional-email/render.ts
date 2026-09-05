// Montagem do e-mail: layout + conteúdo do evento + assunto + canal de contato.
// Isolado do transporte para poder ser testado e para trocar de provedor
// (SMTP transacional no domínio próprio miseon.app.br — provedor vem das
// secrets SMTP_*; migrar para Resend não toca em template nenhum).

import Handlebars from 'npm:handlebars@4.7.8';

// Domínio de produção. Vive em secret porque muda quando o domínio
// próprio entrar no ar — link errado em e-mail não tem como ser corrigido
// depois de enviado.
export const SITE = (Deno.env.get('SITE_URL') ?? 'https://miseon.vercel.app').replace(/\/+$/, '');

export type Classe = 'TRANSACIONAL' | 'MARKETING';

export interface Loja {
  id?: string;
  nome?: string;
  slug?: string;
  logo_url?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  endereco?: string | null;
  cor_primaria?: string | null;
  chat_ia_ativo?: boolean | null;
}

export interface EventoConfig {
  classe: Classe;
  assunto: (d: Record<string, any>, loja: Loja) => string;
  previa: (d: Record<string, any>, loja: Loja) => string;
  rotulo: string;
  subtitulo: (d: Record<string, any>) => string;
  contato: boolean;
}

const MISEON_LARANJA = '#FC5B24';

export const EVENTOS: Record<string, EventoConfig> = {
  'pagamento-confirmado': {
    classe: 'TRANSACIONAL',
    assunto: (d, l) => `Pagamento confirmado — pedido #${d.pedido_numero} · ${l.nome}`,
    previa: (d) => `Recebemos R$ ${d.valor} do seu pedido.`,
    rotulo: 'Aviso de pedido',
    subtitulo: (d) => `Pedido #${d.pedido_numero}`,
    contato: true,
  },
  'pedido-recebido': {
    classe: 'TRANSACIONAL',
    assunto: (d, l) => `Pedido #${d.pedido_numero} confirmado na ${l.nome}`,
    previa: () => 'Seu pedido entrou na fila de preparo.',
    rotulo: 'Aviso de pedido',
    subtitulo: (d) => `Pedido #${d.pedido_numero}`,
    contato: true,
  },
  'pedido-a-caminho': {
    classe: 'TRANSACIONAL',
    assunto: (d) => `Seu pedido #${d.pedido_numero} saiu para entrega`,
    previa: () => 'O entregador já está a caminho do seu endereço.',
    rotulo: 'Aviso de pedido',
    subtitulo: (d) => `Pedido #${d.pedido_numero} · a caminho`,
    contato: true,
  },
  'pedido-entregue': {
    classe: 'TRANSACIONAL',
    assunto: (d) => `Pedido #${d.pedido_numero} entregue — bom apetite!`,
    previa: (_, l) => `Obrigado por pedir na ${l.nome}.`,
    rotulo: 'Aviso de pedido',
    subtitulo: (d) => `Pedido #${d.pedido_numero} · concluído`,
    contato: true,
  },
  'carrinho-abandonado': {
    classe: 'MARKETING',
    assunto: (_, l) => `Seu carrinho na ${l.nome} ainda está salvo`,
    previa: () => 'Faltou pouco para finalizar seu pedido.',
    rotulo: 'Oferta da loja',
    subtitulo: () => 'Carrinho salvo',
    contato: false,
  },
  'cupom-disponivel': {
    classe: 'MARKETING',
    assunto: (_, l) => `A ${l.nome} preparou um desconto para você`,
    previa: (d) => `${d.valor_exibicao} no seu próximo pedido.`,
    rotulo: 'Oferta da loja',
    subtitulo: () => 'Oferta para clientes da casa',
    contato: false,
  },
  'acesso-equipe': {
    classe: 'TRANSACIONAL',
    assunto: (_, l) => `Seu acesso ao sistema da ${l.nome}`,
    previa: (d) => `Login criado como ${d.papel_rotulo}.`,
    rotulo: 'Acesso da equipe',
    subtitulo: (d) => `Equipe · ${d.papel_rotulo}`,
    contato: true,
  },
  'boas-vindas-loja': {
    classe: 'TRANSACIONAL',
    assunto: (_, l) => `Bem-vindo(a) ao ecossistema MiseOn, ${l.nome}!`,
    previa: (d) => `Seu teste grátis de ${d.trial_dias} dias já começou.`,
    rotulo: 'Boas-vindas',
    subtitulo: () => 'Sua loja está pronta',
    contato: false,
  },
  // Evento invertido: quem cobra é a MiseOn, não a loja — despachar() no
  // worker troca o remetente para "MiseOn" só para este evento.
  'nota-fiscal-assinatura': {
    classe: 'TRANSACIONAL',
    assunto: () => 'Sua nota fiscal da assinatura MiseOn',
    previa: (d) => `Nota fiscal de R$ ${d.valor} disponível.`,
    rotulo: 'Financeiro MiseOn',
    subtitulo: () => 'Nota fiscal da assinatura',
    contato: false,
  },
};

// Um canal só: o que de fato responde rápido nesta loja.
// O chat interno só lidera quando a IA está ativa (responde de madrugada);
// sem ela, o WhatsApp é onde a equipe do restaurante realmente está.
export function resolverContato(loja: Loja, dados: Record<string, any>) {
  const ref = dados.pedido_numero ? `pedido-${dados.pedido_numero}` : '';

  if (loja.chat_ia_ativo && loja.slug) {
    return {
      url: `${SITE}/${loja.slug}?chat=1${ref ? `&assunto=${ref}` : ''}`,
      rotulo: 'Falar com a loja pelo chat',
      nota: 'Resposta imediata, 24h — a equipe assume quando precisar.',
    };
  }

  const zap = (loja.whatsapp ?? '').replace(/\D/g, '');
  if (zap) {
    const texto = encodeURIComponent(
      dados.pedido_numero ? `Olá! Falo sobre o pedido #${dados.pedido_numero}.` : 'Olá!',
    );
    return { url: `https://wa.me/55${zap}?text=${texto}`, rotulo: 'Chamar no WhatsApp', nota: '' };
  }

  const fone = (loja.telefone ?? '').replace(/\D/g, '');
  if (fone) return { url: `tel:+55${fone}`, rotulo: `Ligar para ${loja.telefone}`, nota: '' };

  return null;
}

import { TEMPLATES } from './templates/index.ts';

const cache = new Map<string, HandlebarsTemplateDelegate>();

function compilar(nome: string) {
  const emCache = cache.get(nome);
  if (emCache) return emCache;
  const fonte = TEMPLATES[nome];
  if (!fonte) throw new Error(`Template não encontrado: ${nome}`);
  const tpl = Handlebars.compile(fonte);
  cache.set(nome, tpl);
  return tpl;
}

// Alternativa em texto puro: filtros anti-spam penalizam e-mail só-HTML.
function versaoTexto(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&times;/g, 'x')
    .replace(/&minus;/g, '-')
    .replace(/&#10003;/g, '')
    .replace(/&zwnj;|&#847;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

export async function montarEmail(
  evento: string,
  dados: Record<string, any>,
  loja: Loja,
  opcoes: { descadastro_url?: string } = {},
) {
  const cfg = EVENTOS[evento];
  if (!cfg) throw new Error(`Evento de e-mail desconhecido: ${evento}`);

  const lojaCtx = {
    ...loja,
    nome: loja.nome ?? 'Sua loja',
    cor_primaria: loja.cor_primaria || MISEON_LARANJA,
    inicial: (loja.nome ?? 'M').trim().charAt(0).toUpperCase(),
  };

  const conteudo = (await compilar(evento))({ ...dados, loja: lojaCtx });
  const html = (await compilar('_layout'))({
    assunto: cfg.assunto(dados, lojaCtx),
    previa: cfg.previa(dados, lojaCtx),
    rotulo_plataforma: cfg.rotulo,
    subtitulo_loja: cfg.subtitulo(dados),
    mostrar_contato: cfg.contato,
    contato: cfg.contato ? resolverContato(lojaCtx, dados) : null,
    marketing: cfg.classe === 'MARKETING',
    descadastro_url: opcoes.descadastro_url ?? '',
    site: SITE,
    loja: lojaCtx,
    conteudo,
  });

  return {
    assunto: cfg.assunto(dados, lojaCtx),
    html,
    texto: versaoTexto(html),
    classe: cfg.classe,
  };
}

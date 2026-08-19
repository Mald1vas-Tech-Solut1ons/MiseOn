// Paleta curada e tokens de tema da loja (Minha Loja / Aparência).
// Curados de propósito para manter a identidade coesa sem depender de combinações aleatórias.

export const PALETA_CORES = [
  '#000000', '#4b5563', '#d1d5db', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
] as const;

export type TemaLoja = 'claro' | 'escuro';

export const PALETA_FUNDO_CLARO = [
  '#ffffff', '#f8fafc', '#fdf6e3', '#f3f4f6', // Claros / Off-white / Bege
  '#fff1f2', '#f0fdf4', '#f0f9ff', '#fefce8', // Pastéis Suaves (Rosa, Menta, Azul, Amarelo)
] as const;

export const PALETA_FUNDO_ESCURO = [
  '#111827', '#0f172a', '#171717', '#000000', // Escuros / Black
  '#334155', '#450a0a', '#064e3b', '#2e1065', // Tons escuros profundos (Ardósia, Vinho, Floresta, Roxo)
  '#1f2937', '#172033', '#102a43', '#1f1235',
] as const;

export const PALETA_FUNDO = [...PALETA_FUNDO_CLARO, ...PALETA_FUNDO_ESCURO] as const;

export const PALETA_FUNDO_POR_TEMA: Record<TemaLoja, readonly string[]> = {
  claro: PALETA_FUNDO_CLARO,
  escuro: PALETA_FUNDO_ESCURO,
};

export interface FonteOpcao { nome: string; familia: string; estilo: string }

export const FONTES: FonteOpcao[] = [
  { nome: 'Inter', familia: "'Inter', sans-serif", estilo: 'Padrão — limpa e neutra' },
  { nome: 'Poppins', familia: "'Poppins', sans-serif", estilo: 'Geométrica arredondada' },
  { nome: 'Montserrat', familia: "'Montserrat', sans-serif", estilo: 'Moderna e forte' },
  { nome: 'Nunito', familia: "'Nunito', sans-serif", estilo: 'Suave e amigável' },
  { nome: 'Quicksand', familia: "'Quicksand', sans-serif", estilo: 'Descontraída' },
  { nome: 'Playfair Display', familia: "'Playfair Display', serif", estilo: 'Elegante, editorial' },
  { nome: 'Roboto Slab', familia: "'Roboto Slab', serif", estilo: 'Robusta, artesanal' },
  { nome: 'Bebas Neue', familia: "'Bebas Neue', sans-serif", estilo: 'Impacto, letreiro' },
];

export const fonteFamilia = (nome?: string) => FONTES.find((f) => f.nome === nome)?.familia ?? FONTES[0].familia;

export function resolverTemaLoja(tema?: TemaLoja | null, fundo?: string | null): TemaLoja {
  if (tema === 'claro' || tema === 'escuro') return tema;
  return isLightColor(fundo ?? undefined) ? 'claro' : 'escuro';
}

export function corComAlpha(hex: string, alpha: string) {
  const limpa = hex.replace('#', '');
  if (limpa.length !== 6) return hex;
  return `#${limpa}${alpha}`;
}

function normalizarHex(hex?: string) {
  if (!hex) return null;
  const limpo = hex.replace('#', '');
  if (limpo.length === 3) return `#${limpo.split('').map((c) => c + c).join('')}`;
  if (limpo.length === 6) return `#${limpo}`;
  return null;
}

function hexParaRgb(hex?: string) {
  const normalizado = normalizarHex(hex);
  if (!normalizado) return null;
  const valor = parseInt(normalizado.slice(1), 16);
  return {
    r: (valor >> 16) & 0xff,
    g: (valor >> 8) & 0xff,
    b: valor & 0xff,
  };
}

function rgbParaHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function rgbParaHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = 60 * (((gn - bn) / delta) % 6);
        break;
      case gn:
        h = 60 * (((bn - rn) / delta) + 2);
        break;
      default:
        h = 60 * (((rn - gn) / delta) + 4);
        break;
    }
  }

  return {
    h: h < 0 ? h + 360 : h,
    s: s * 100,
    l: l * 100,
  };
}

function hslParaRgb(h: number, s: number, l: number) {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

function ajustarTom(hex: string, tema: TemaLoja) {
  const rgb = hexParaRgb(hex);
  if (!rgb) return tema === 'claro' ? PALETA_FUNDO_CLARO[0] : PALETA_FUNDO_ESCURO[0];
  const hsl = rgbParaHsl(rgb.r, rgb.g, rgb.b);
  const s = Math.max(22, Math.min(78, hsl.s));
  const l = tema === 'claro'
    ? Math.max(92, Math.min(97, 96 - (s / 24)))
    : Math.max(10, Math.min(19, 15 + (s / 35)));
  const convertido = hslParaRgb(hsl.h, s, l);
  return rgbParaHex(convertido.r, convertido.g, convertido.b);
}

export function misturarCores(origem: string, destino: string, pesoDestino: number) {
  const a = hexParaRgb(origem);
  const b = hexParaRgb(destino);
  if (!a || !b) return origem;
  const peso = Math.max(0, Math.min(1, pesoDestino));
  return rgbParaHex(
    a.r * (1 - peso) + b.r * peso,
    a.g * (1 - peso) + b.g * peso,
    a.b * (1 - peso) + b.b * peso,
  );
}

/**
 * Luminância relativa da WCAG 2.x. Diferente de isLightColor(), que usa uma
 * média ponderada simples: aqui cada canal passa pela curva sRGB antes de
 * entrar na conta, que é o que a norma exige para calcular contraste.
 */
function luminanciaRelativa(hex: string) {
  const rgb = hexParaRgb(hex);
  if (!rgb) return 0;
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b);
}

/** Razão de contraste WCAG entre duas cores (1 = idênticas, 21 = preto/branco). */
export function contrasteEntre(corA: string, corB: string) {
  const a = luminanciaRelativa(normalizarHex(corA) ?? '#000000');
  const b = luminanciaRelativa(normalizarHex(corB) ?? '#FFFFFF');
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Devolve a cor da marca ajustada até ficar legível sobre o fundo informado.
 *
 * Por que existe: o lojista escolhe cor_primaria e cor de fundo livremente no
 * painel, e nada impedia combinações ilegíveis. O Lanche do Paulista ficou com
 * preço vermelho (#EF4444) sobre marrom (#4E350A) — contraste 3.04:1, abaixo do
 * mínimo 4.5:1 da WCAG AA. Quem perde é o cliente final tentando ler o PREÇO.
 *
 * Só mexe na luminosidade: matiz e saturação são preservados, então a cor
 * continua sendo reconhecidamente a da marca — apenas clareia (sobre fundo
 * escuro) ou escurece (sobre fundo claro) até passar do limiar. Se nem o
 * extremo resolver, devolve o melhor que conseguiu.
 */
export function corLegivelSobre(corMarca: string, fundo: string, alvo = 4.5) {
  const base = normalizarHex(corMarca) ?? '#FC5B24';
  const bg = normalizarHex(fundo) ?? '#FFFFFF';
  if (contrasteEntre(base, bg) >= alvo) return base;

  const rgb = hexParaRgb(base);
  if (!rgb) return base;
  const hsl = rgbParaHsl(rgb.r, rgb.g, rgb.b);
  const clarear = !isLightColor(bg);

  let melhor = base;
  let melhorRazao = contrasteEntre(base, bg);

  for (let passo = 1; passo <= 20; passo++) {
    const l = clarear
      ? Math.min(100, hsl.l + passo * 4)
      : Math.max(0, hsl.l - passo * 4);
    const c = hslParaRgb(hsl.h, hsl.s, l);
    const hex = rgbParaHex(c.r, c.g, c.b);
    const razao = contrasteEntre(hex, bg);
    if (razao > melhorRazao) { melhor = hex; melhorRazao = razao; }
    if (razao >= alvo) return hex;
  }
  return melhor;
}

export function obterTokensLoja(fundo: string, tema: TemaLoja, corBase = '#FC5B24') {
  const fundoClaro = isLightColor(fundo);
  const base = normalizarHex(corBase) ?? '#FC5B24';
  return {
    tema,
    fundo,
    texto: fundoClaro ? '#111827' : '#F8FAFC',
    textoSuave: fundoClaro ? '#475569' : '#CBD5E1',
    textoFraco: fundoClaro ? '#64748B' : '#94A3B8',
    surface: fundoClaro ? misturarCores(base, '#FFFFFF', 0.965) : misturarCores(base, '#0F172A', 0.8),
    surfaceMuted: fundoClaro ? misturarCores(base, '#FFFFFF', 0.925) : misturarCores(base, '#111827', 0.72),
    card: fundoClaro ? misturarCores(base, '#FFFFFF', 0.985) : misturarCores(base, '#0B1220', 0.76),
    border: fundoClaro ? misturarCores(base, '#CBD5E1', 0.8) : misturarCores(base, '#475569', 0.62),
    borderStrong: fundoClaro ? misturarCores(base, '#94A3B8', 0.7) : misturarCores(base, '#64748B', 0.52),
    destaque: corComAlpha(base, fundoClaro ? '16' : '24'),
  };
}

export function obterFundoLojaPorTema(
  tema: TemaLoja,
  fundos?: { cor_fundo_claro?: string | null; cor_fundo_escuro?: string | null; cor_texto?: string | null; cor_primaria?: string | null },
) {
  const baseConfigurada = normalizarHex(fundos?.cor_texto ?? undefined);
  if (baseConfigurada) return ajustarTom(baseConfigurada, tema);

  if (tema === 'escuro') {
    return fundos?.cor_fundo_escuro
      || (fundos?.cor_primaria ? ajustarTom(fundos.cor_primaria, 'escuro') : undefined)
      || PALETA_FUNDO_ESCURO[0];
  }
  return fundos?.cor_fundo_claro
    || (fundos?.cor_primaria ? ajustarTom(fundos.cor_primaria, 'claro') : undefined)
    || PALETA_FUNDO_CLARO[0];
}

// Calcula a luminância da cor e retorna true se for uma cor clara (ex: branco, amarelo claro)
export function isLightColor(hex?: string) {
  if (!hex) return false;
  const c = hex.replace('#', '');
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >>  8) & 0xff;
  const b = (rgb >>  0) & 0xff;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 140; // Limiar de claridade
}

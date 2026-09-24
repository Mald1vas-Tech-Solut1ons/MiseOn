import { getOptimizedImageUrl } from './cdn';
import type { Produto } from '../types';

const FOTOS_PRODUTOS: Record<string, string> = {
  'X-BACON': 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&auto=format&fit=crop&q=80',
  'COMBO X-BACON': 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=600&auto=format&fit=crop&q=80',
  'SMASH DUPLO': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
  'X-SALADA': 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80',
  'X-PAULISTA': 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=600&auto=format&fit=crop&q=80',
  'SMASH FIT DE PATINHO': 'https://images.unsplash.com/photo-1521305916504-4a1121188589?w=600&auto=format&fit=crop&q=80',
  'BURGER FIT DE FRANGO': 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&auto=format&fit=crop&q=80',
  'BOWL FIT DE FRANGO': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
  'SALADA CAESAR FIT': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80',
  'BATATA FRITA': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
  'BATATA CHEDDAR E BACON': 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&auto=format&fit=crop&q=80',
  'BATATA DOCE RÚSTICA': 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80',
  'COCA-COLA LATA 350ML': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
  'GUARANÁ LATA 350ML': 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&auto=format&fit=crop&q=80',
  'ÁGUA MINERAL 500ML': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&auto=format&fit=crop&q=80',
};

/**
 * Uma família pode ter mais de uma foto. Quando tem, produtos diferentes da
 * mesma família recebem variantes diferentes — é o que impede "Marmita P" e
 * "Marmita M" de aparecerem lado a lado com a mesma imagem.
 */
const FOTOS_POR_FAMILIA: [RegExp, string | readonly string[]][] = [
  [/BOMBOM|CHOCOLATE|SOBREMESA|DOCE|PUDIM|BROWNIE|MOUSSE|SORVETE|A[CÇ]A[IÍ]/,
   'https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?w=600&auto=format&fit=crop&q=80'],
  [/REFRIGERANTE|COCA|GUARAN|SUCO|BEBIDA|[AÁ]GUA|CERVEJA|LATA|GARRAFA|MILK|SHAKE|CAF[EÉ]/,
   'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=600&auto=format&fit=crop&q=80'],
  [/BATATA|FRITAS|ONION|NUGGET|PORCAO|POR[CÇ][AÃ]O|ACOMPANHAMENTO/,
   'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80'],
  [/SALADA|BOWL|FIT|VEGANO|VEGETARIAN/,
   'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80'],
  [/PIZZA|CALZONE/,
   'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80'],
  [/COMBO|BURGER|X-|SMASH|LANCHE|SANDU|HAMBURG/,
   'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80'],

  // ── Buffet, marmita, PF e pratos de restaurante ──────────────────────────
  // O nicho por quilo/self-service não tinha nenhuma família aqui: "Buffet por
  // Quilo", "Marmita P" e "Marmita M" caíam todos na FOTO_GENERICA e o cardápio
  // exibia a MESMA imagem em três produtos diferentes (visto em /demo-por-quilo
  // em 15/09/2026). Foto repetida é o defeito clássico de vitrine amadora — e
  // justamente numa das operações que o MiseOn vende.
  //
  // Duas regras para não recriar o problema:
  //  1. ORDEM — o item específico vem antes do genérico. "Esfirra de carne" tem
  //     que bater em ESFIRRA, não em CARNE; por isso salgados e pratos nomeados
  //     ficam acima da família de proteína.
  //  2. POOLS DISJUNTOS — nenhuma URL se repete entre famílias. Se duas famílias
  //     compartilham foto, dois produtos vizinhos voltam a ficar iguais.

  // Salgados e pratos nomeados primeiro (contêm palavras que a família de
  // proteína também casa: carne, frango, queijo).
  [/ESFIRRA|ESFIHA|COXINHA|PASTEL|SALGADO|EMPADA|KIBE|QUIBE|ENROLADINHO/, [
    'https://images.unsplash.com/photo-1541529086526-db283c563270?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80',
  ]],
  [/FEIJOADA|FEIJ[AÃ]O|TROPEIRO|VIRADO|BAI[AÃ]O/, 'https://images.unsplash.com/photo-1604909052743-94e838986d24?w=600&auto=format&fit=crop&q=80'],
  [/LASANHA|PARMEGIANA|MASSA|MACARR|ESPAGUETE|PENNE|NHOQUE|TALHARIM/, [
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&auto=format&fit=crop&q=80',
  ]],
  [/STROGONOFF|STROGONOF|FRANGO|GALINHA|SOBRECOXA/, [
    'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=600&auto=format&fit=crop&q=80',
  ]],
  [/PEIXE|SALM[AÃ]O|TILAPIA|TIL[AÁ]PIA|BACALHAU|CAMAR[AÃ]O|FRUTOS DO MAR/, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80'],
  [/CHURRASCO|GRELHAD|PICANHA|COSTELA|CARNE|BIFE|FRALDINHA|ALCATRA|SUINO|SU[IÍ]NO/, [
    'https://images.unsplash.com/photo-1558030006-450675393462?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80',
  ]],
  [/SOPA|CALDO|CANJA|CREME DE/, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80'],
  [/ARROZ|RISOTO|CUSCUZ/, 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=600&auto=format&fit=crop&q=80'],
  [/LEGUME|VERDURA|GUARNI|FAROFA|PUR[EÊ]|MANDIOCA/, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80'],

  // Os genéricos do nicho por último: só pegam o que não foi nomeado acima.
  [/MARMITA|QUENTINHA|MARMITEX/, [
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80',
  ]],
  [/BUFFET|SELF.?SERVICE|POR QUILO|A QUILO|R\$\/KG|KILO/, [
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=600&auto=format&fit=crop&q=80',
  ]],
  // \bPF\b com fronteira de palavra: sem ela, "PF" casaria dentro de outras
  // palavras e sequestraria produtos que nada têm a ver com prato feito.
  [/PRATO FEITO|\bPF\b|EXECUTIVO|REFEI[CÇ][AÃ]O|ALMO[CÇ]O|JANTAR/, [
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600&auto=format&fit=crop&q=80',
  ]],
];

const FOTO_GENERICA =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

/**
 * Escolhe uma variante da família de forma estável: o mesmo nome devolve sempre
 * a mesma foto (nada de imagem trocando entre renders ou entre dispositivos),
 * mas nomes diferentes da mesma família caem em fotos diferentes.
 */
function variante(nome: string, opcoes: string | readonly string[]): string {
  if (typeof opcoes === 'string') return opcoes;
  if (opcoes.length === 1) return opcoes[0];
  let h = 2166136261;
  for (let i = 0; i < nome.length; i++) {
    h ^= nome.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return opcoes[Math.abs(h) % opcoes.length];
}

export function obterFotoFallback(nome: string): string {
  const nomeUpper = (nome || '').toUpperCase().trim();
  if (FOTOS_PRODUTOS[nomeUpper]) return FOTOS_PRODUTOS[nomeUpper];
  for (const [chave, url] of Object.entries(FOTOS_PRODUTOS)) {
    if (nomeUpper.includes(chave)) return url;
  }
  for (const [padrao, url] of FOTOS_POR_FAMILIA) {
    if (padrao.test(nomeUpper)) return variante(nomeUpper, url);
  }
  return FOTO_GENERICA;
}

/** Foto PRÓPRIA do produto, ou '' se ele não tem. O substituto (ilustrativa na
 *  loja de demonstração, espaço reservado na real) é decisão do <FotoProduto>. */
export function obterFotoProduto(p: Pick<Produto, 'imagem_url'>): string {
  if (!p.imagem_url) return '';
  return getOptimizedImageUrl(p.imagem_url) || p.imagem_url;
}


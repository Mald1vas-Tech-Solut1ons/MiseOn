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

const FOTOS_POR_FAMILIA: [RegExp, string][] = [
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
];

const FOTO_GENERICA =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

export function obterFotoFallback(nome: string): string {
  const nomeUpper = (nome || '').toUpperCase().trim();
  if (FOTOS_PRODUTOS[nomeUpper]) return FOTOS_PRODUTOS[nomeUpper];
  for (const [chave, url] of Object.entries(FOTOS_PRODUTOS)) {
    if (nomeUpper.includes(chave)) return url;
  }
  for (const [padrao, url] of FOTOS_POR_FAMILIA) {
    if (padrao.test(nomeUpper)) return url;
  }
  return FOTO_GENERICA;
}

export function obterFotoProduto(p: Produto): string {
  const fotoCurada = obterFotoFallback(p.nome);
  if (!p.imagem_url) return fotoCurada;
  return getOptimizedImageUrl(p.imagem_url) || p.imagem_url || fotoCurada;
}

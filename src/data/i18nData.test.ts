import { describe, it, expect } from 'vitest';
import { tDynamic } from './i18nData';

describe('tDynamic', () => {
  it('devolve o texto intacto em pt-BR, sem tocar no dicionário', () => {
    expect(tDynamic('Finalizar Pedido', 'pt-BR')).toBe('Finalizar Pedido');
    expect(tDynamic('Pizza Calabresa', 'pt-BR')).toBe('Pizza Calabresa');
  });

  it('traduz chave exata do dicionário', () => {
    expect(tDynamic('Finalizar Pedido', 'en-US')).toBe('Checkout');
    expect(tDynamic('AO VIVO', 'en-US')).toBe('LIVE');
    expect(tDynamic('Painel de Senhas', 'en-US')).toBe('Ticket Call Board');
  });

  it('não devolve nada da cadeia de protótipo', () => {
    // Um produto batizado "constructor"/"toString" fazia o acesso solto ao
    // objeto retornar uma função, e o React quebrava ao renderizar.
    for (const chave of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
      expect(typeof tDynamic(chave, 'en-US')).toBe('string');
    }
  });

  it('é estável entre chamadas repetidas (RegExp compartilhado com /g)', () => {
    // Os RegExp agora são criados uma vez só e reaproveitados; sem zerar
    // lastIndex, a segunda chamada devolveria resultado diferente da primeira.
    const alvo = 'Taxa de entrega e Tempo estimado';
    const primeira = tDynamic(alvo, 'en-US');
    for (let i = 0; i < 5; i++) {
      expect(tDynamic(alvo, 'en-US')).toBe(primeira);
    }
  });

  it('traduz uma tela cheia de produtos sem travar a thread', () => {
    // Guarda contra a regressão que existia: os RegExp nasciam dentro do laço,
    // 715 por chamada — ~2,6 ms cada, ~130 ms para 50 produtos por render.
    const nomes = Array.from({ length: 50 }, (_, i) => `Produto Artesanal Especial ${i}`);
    const inicio = performance.now();
    for (let render = 0; render < 20; render++) {
      for (const nome of nomes) tDynamic(nome, 'en-US');
    }
    const msPorRender = (performance.now() - inicio) / 20;
    expect(msPorRender).toBeLessThan(20);
  });
});

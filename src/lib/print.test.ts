// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { imprimir, regraDePagina, MARGEM_SEGURA_MM } from './print';

afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('página da bobina', () => {
  it('declara a largura do papel e a altura exata do conteúdo (nada de A4)', () => {
    // 378 px ≈ 100 mm de conteúdo + 3 mm de margem segura de cada lado.
    expect(regraDePagina(80, 378)).toBe('@page { size: 80mm 107mm; margin: 0; }');
    expect(regraDePagina(58, 378)).toBe('@page { size: 58mm 107mm; margin: 0; }');
  });

  it('cupom curto não vira tira de papel impossível de destacar', () => {
    expect(regraDePagina(80, 10)).toBe('@page { size: 80mm 40mm; margin: 0; }');
  });

  it('a margem segura existe: a cabeça térmica não imprime rente à borda', () => {
    expect(MARGEM_SEGURA_MM).toBeGreaterThanOrEqual(2);
  });
});

describe('motor de impressão', () => {
  it('monta o cupom na largura real da bobina e fixa a página antes de imprimir', () => {
    vi.useFakeTimers();
    const printSpy = vi.fn();
    const criar = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = criar(tag);
      if (tag === 'iframe') {
        // jsdom não imprime: registra a chamada.
        queueMicrotask(() => {
          const w = (el as HTMLIFrameElement).contentWindow;
          if (w) w.print = printSpy;
        });
      }
      return el;
    });

    imprimir({
      template: 'RECIBO_CLIENTE', lojaNome: 'Loja Teste', larguraMm: 58,
      pedido: { numero: 7, senha: 12, criado_em: new Date().toISOString(), valor_total: 10, tipo_pedido: 'RETIRADA_BALCAO' } as never,
      itens: [{ nome_produto: 'Lanche', quantidade: 1, preco_unitario: 10, itens_pedido_opcoes: [] }] as never,
    });

    const iframe = document.querySelector('iframe')!;
    expect(iframe.style.width).toBe('58mm');
    const doc = iframe.contentDocument!;
    expect(doc.head.innerHTML).toContain('width: 58mm');

    vi.advanceTimersByTime(600);
    const regras = Array.from(doc.head.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(regras).toMatch(/@page \{ size: 58mm \d+mm; margin: 0; \}/);
  });
});

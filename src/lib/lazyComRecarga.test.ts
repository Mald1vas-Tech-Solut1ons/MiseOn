// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { lazyComRecarga, liberarNovaRecarga } from './lazyComRecarga';

/**
 * A recuperação de chunk morto.
 *
 * O que estes testes protegem não é o caminho feliz — é a TRAVA. Recarregar a
 * página como resposta a erro de carregamento é a coisa mais perigosa que este
 * arquivo faz: sem limite, uma indisponibilidade real vira laço infinito de
 * recarga na cara do lojista. Por isso o caso que mais importa aqui é o da
 * segunda falha seguida, que precisa deixar o erro subir.
 */

const carregarFabrica = (comp: ReturnType<typeof lazyComRecarga>) =>
  // O payload interno do lazy do React é onde mora a nossa função.
  (comp as unknown as { _payload: { _result: () => Promise<unknown> } })._payload._result();

describe('lazyComRecarga', () => {
  let recarregou: number;

  beforeEach(() => {
    recarregou = 0;
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: () => { recarregou += 1; } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não interfere quando o import funciona', async () => {
    const componente = { default: () => null };
    const alvo = lazyComRecarga(() => Promise.resolve(componente as never));

    await expect(carregarFabrica(alvo)).resolves.toBe(componente);
    expect(recarregou).toBe(0);
  });

  it('recarrega uma vez quando o chunk sumiu', async () => {
    const alvo = lazyComRecarga(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module')));

    // A promessa devolvida nunca resolve de propósito: a página está saindo.
    // Esperar por ela travaria o teste, então só o efeito é observado.
    carregarFabrica(alvo);
    await Promise.resolve();
    await Promise.resolve();

    expect(recarregou).toBe(1);
  });

  it('na segunda falha seguida deixa o erro subir em vez de entrar em laço', async () => {
    const falha = () => lazyComRecarga(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module')));

    falha();
    carregarFabrica(falha());
    await Promise.resolve();
    await Promise.resolve();

    const segunda = falha();
    await expect(carregarFabrica(segunda)).rejects.toThrow('Failed to fetch');
  });

  it('liberarNovaRecarga devolve a permissão para a próxima publicação', async () => {
    const criar = () => lazyComRecarga(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module')));

    carregarFabrica(criar());
    await Promise.resolve();
    await Promise.resolve();
    expect(recarregou).toBe(1);

    // App subiu: a permissão volta.
    liberarNovaRecarga();

    carregarFabrica(criar());
    await Promise.resolve();
    await Promise.resolve();
    expect(recarregou).toBe(2);
  });

  it('sem sessionStorage não recarrega, para não arriscar laço', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });

    const alvo = lazyComRecarga(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module')));

    await expect(carregarFabrica(alvo)).rejects.toThrow('Failed to fetch');
    expect(recarregou).toBe(0);
  });
});

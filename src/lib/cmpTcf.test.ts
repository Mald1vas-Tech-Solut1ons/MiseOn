// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { existeCmpTcf, escutarCmpTcf, type DecisaoCmp } from './cmpTcf';

/**
 * A CMP do Google só aparece no tráfego do EEE, Reino Unido e Suíça — daqui
 * do Brasil ela nunca vai estar na página para ser testada à mão. Estes
 * testes fixam o contrato: o que cada combinação de finalidades do TCF
 * significa para o consentimento interno.
 */

type RetornoTcf = (dados: unknown, sucesso: boolean) => void;

function plantarCmp() {
  const ouvintes: RetornoTcf[] = [];
  (window as unknown as { __tcfapi: unknown }).__tcfapi = (
    comando: string,
    _versao: number,
    retorno: RetornoTcf,
  ) => {
    if (comando === 'addEventListener') ouvintes.push(retorno);
  };
  return {
    emitir(dados: unknown, sucesso = true) {
      ouvintes.forEach((o) => o(dados, sucesso));
    },
  };
}

afterEach(() => {
  delete (window as unknown as { __tcfapi?: unknown }).__tcfapi;
});

describe('ponte com a CMP certificada do Google', () => {
  it('sem CMP na página, não há o que escutar', () => {
    expect(existeCmpTcf()).toBe(false);
    const cancelar = escutarCmpTcf(() => {
      throw new Error('não deveria ser chamado');
    });
    cancelar();
  });

  it('consentimento completo libera marketing e analíticos', () => {
    const cmp = plantarCmp();
    const visto: DecisaoCmp[] = [];
    escutarCmpTcf((d) => visto.push(d));

    cmp.emitir({
      eventStatus: 'useractioncomplete',
      purpose: { consents: { 1: true, 3: true, 4: true, 8: true } },
    });

    expect(visto).toHaveLength(1);
    expect(visto[0]).toEqual({ marketing: true, analiticos: true, respondido: true });
  });

  it('sem a finalidade 1 nada é liberado, mesmo com as outras marcadas', () => {
    // A finalidade 1 é armazenar informação no dispositivo. Sem ela não há
    // cookie a gravar, e as demais não têm onde se apoiar.
    const cmp = plantarCmp();
    const visto: DecisaoCmp[] = [];
    escutarCmpTcf((d) => visto.push(d));

    cmp.emitir({
      eventStatus: 'useractioncomplete',
      purpose: { consents: { 1: false, 3: true, 4: true, 8: true } },
    });

    expect(visto[0]).toMatchObject({ marketing: false, analiticos: false });
  });

  it('anúncio personalizado exige criar E usar perfil (3 e 4)', () => {
    const cmp = plantarCmp();
    const visto: DecisaoCmp[] = [];
    escutarCmpTcf((d) => visto.push(d));

    cmp.emitir({
      eventStatus: 'useractioncomplete',
      purpose: { consents: { 1: true, 3: true, 4: false, 8: true } },
    });

    expect(visto[0]).toMatchObject({ marketing: false, analiticos: true });
  });

  it('ignora o evento de abertura da janela — ali ninguém decidiu nada', () => {
    const cmp = plantarCmp();
    const retorno = vi.fn();
    escutarCmpTcf(retorno);

    cmp.emitir({ eventStatus: 'cmpuishown', purpose: { consents: {} } });

    expect(retorno).not.toHaveBeenCalled();
  });

  it('chamada que falhou não vira decisão', () => {
    const cmp = plantarCmp();
    const retorno = vi.fn();
    escutarCmpTcf(retorno);

    cmp.emitir({ eventStatus: 'useractioncomplete', purpose: { consents: { 1: true } } }, false);

    expect(retorno).not.toHaveBeenCalled();
  });

  it('depois de cancelado, para de ouvir', () => {
    const cmp = plantarCmp();
    const retorno = vi.fn();
    const cancelar = escutarCmpTcf(retorno);

    cancelar();
    cmp.emitir({ eventStatus: 'useractioncomplete', purpose: { consents: { 1: true, 3: true, 4: true } } });

    expect(retorno).not.toHaveBeenCalled();
  });
});

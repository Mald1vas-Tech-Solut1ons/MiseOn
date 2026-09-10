import { describe, expect, it } from 'vitest';
import { criarMensagemDisplay, validarUrlPainelRecebida } from './googleCast';

describe('Google Cast do PainelTV', () => {
  it('aceita somente URL tokenizada do PainelTV na mesma origem', () => {
    expect(validarUrlPainelRecebida(
      'https://app.miseon.com.br/tv/natureba?modo=auto&token=segredo',
      'https://app.miseon.com.br',
    )).toBe('https://app.miseon.com.br/tv/natureba?modo=auto&token=segredo');

    expect(validarUrlPainelRecebida(
      'https://malicioso.test/tv/natureba?modo=auto&token=segredo',
      'https://app.miseon.com.br',
    )).toBeNull();
    expect(validarUrlPainelRecebida(
      'https://app.miseon.com.br/admin/loja?modo=auto&token=segredo',
      'https://app.miseon.com.br',
    )).toBeNull();
    expect(validarUrlPainelRecebida(
      'https://app.miseon.com.br/tv/natureba?modo=auto',
      'https://app.miseon.com.br',
    )).toBeNull();
  });

  it('envia apenas instrução pública de display', () => {
    const mensagem = criarMensagemDisplay(
      'https://app.miseon.com.br/tv/natureba?modo=senhas&token=segredo',
      'senhas',
    );
    expect(mensagem.type).toBe('LOAD_DISPLAY');
    expect(mensagem.mode).toBe('senhas');
    expect(Object.keys(mensagem).sort()).toEqual(['mode', 'sentAt', 'type', 'url']);
  });
});

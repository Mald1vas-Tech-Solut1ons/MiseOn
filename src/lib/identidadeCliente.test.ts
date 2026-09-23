// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { esquecerIdentidade, lerIdentidade, salvarIdentidade } from './identidadeCliente';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('identidade do cliente neste aparelho', () => {
  it('fechar o carrinho e voltar devolve nome e telefone', () => {
    salvarIdentidade('lanchepaulista', { nome: 'Elisângela', telefone: '(11) 95236-5000' });
    expect(lerIdentidade('lanchepaulista')).toMatchObject({ nome: 'Elisângela', telefone: '(11) 95236-5000' });
  });

  it('é por loja: outra loja não recebe os dados', () => {
    salvarIdentidade('lanchepaulista', { nome: 'Elisângela', telefone: '11952365000' });
    expect(lerIdentidade('outraloja')).toMatchObject({ nome: '', telefone: '' });
  });

  it('mesa e cardápio usam a mesma identidade (e a chave antiga da mesa é aproveitada)', () => {
    localStorage.setItem('miseon_nome_mesa_lanchepaulista', 'Rafael');
    expect(lerIdentidade('lanchepaulista').nome).toBe('Rafael');
    salvarIdentidade('lanchepaulista', { telefone: '11999990000' });
    expect(lerIdentidade('lanchepaulista')).toMatchObject({ nome: 'Rafael', telefone: '11999990000' });
    expect(localStorage.getItem('miseon_nome_mesa_lanchepaulista')).toBeNull();
  });

  it('nome em branco não apaga o nome já lembrado', () => {
    salvarIdentidade('l', { nome: 'Ana' });
    salvarIdentidade('l', { nome: '   ' });
    expect(lerIdentidade('l').nome).toBe('Ana');
  });

  it('navegador que bloqueia armazenamento não quebra o pedido', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(() => salvarIdentidade('l', { nome: 'Ana' })).not.toThrow();
    expect(lerIdentidade('l')).toMatchObject({ nome: '', telefone: '' });
  });

  it('esquecer limpa tudo', () => {
    salvarIdentidade('l', { nome: 'Ana', telefone: '11999990000' });
    esquecerIdentidade('l');
    expect(lerIdentidade('l').nome).toBe('');
  });
});

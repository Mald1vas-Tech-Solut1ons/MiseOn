import { describe, it, expect } from 'vitest';
import { chaveDeTela } from '../src/lib/chaveDeTela';

/**
 * Regressao real: a animacao de troca de tela usava `key={pathname}` em volta
 * do <Routes> inteiro. Como a chave mudava a cada navegacao, o React destruia e
 * recriava o AdminLayout junto — a sidebar virava outro no DOM, o scroll voltava
 * pro topo, o modulo aberto deixava de aparecer marcado no menu e a sessao era
 * consultada de novo no banco a cada clique.
 *
 * O contrato que estes testes protegem: dentro de uma area com layout proprio,
 * a chave NAO pode variar por rota.
 */
describe('chaveDeTela', () => {
  it('mantem a mesma chave entre modulos do painel admin', () => {
    const chaves = [
      '/admin',
      '/admin/inicio',
      '/admin/estoque',
      '/admin/cardapio',
      '/admin/pedidos/9f3a-123',
    ].map(chaveDeTela);

    expect(new Set(chaves).size).toBe(1);
    expect(chaves[0]).toBe('/admin');
  });

  it('mantem a mesma chave dentro do superadmin e do entregador', () => {
    expect(chaveDeTela('/superadmin/lojas')).toBe(chaveDeTela('/superadmin'));
    expect(chaveDeTela('/entregador/rotas')).toBe(chaveDeTela('/entregador'));
  });

  it('nao confunde areas diferentes entre si', () => {
    expect(chaveDeTela('/admin/inicio')).not.toBe(chaveDeTela('/superadmin'));
    expect(chaveDeTela('/entregador')).not.toBe(chaveDeTela('/admin'));
  });

  it('nao captura rota publica que apenas comeca com o mesmo texto', () => {
    // `/admins-da-casa` seria uma loja publica com esse slug: nao pode cair
    // no bucket do painel so por causa do prefixo.
    expect(chaveDeTela('/admins-da-casa')).toBe('/admins-da-casa');
    expect(chaveDeTela('/entregadores')).toBe('/entregadores');
  });

  it('segue usando o pathname nas telas publicas, que nao tem layout persistente', () => {
    expect(chaveDeTela('/lanchepaulista')).toBe('/lanchepaulista');
    expect(chaveDeTela('/blog/algum-post')).toBe('/blog/algum-post');
    expect(chaveDeTela('/acesso')).toBe('/acesso');
  });
});

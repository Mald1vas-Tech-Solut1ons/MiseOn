import { mockSupabase } from '../support/mockDB';

describe('Autenticação', () => {
  beforeEach(() => {
    mockSupabase();
  });

  it('deve simular login e exibir "Minha Conta"', () => {
    cy.visit('/teste');
    cy.wait('@getLojas');
    cy.dismissCookieBanner();

    // Ao invés de clicar no botão e sair da página (OAuth redirect), 
    // nós injetamos o mock de autenticação e recarregamos.
    cy.mockAuth();
    cy.visit('/teste');

    // Com o usuário mockado, a tela deve mostrar "Minha Conta"
    cy.contains('Minha Conta').should('be.visible');

    // Testar Logout
    cy.contains('button', 'Minha Conta').click();
    
    // Aguarda o modal carregar os dados assíncronos e exibir o botão "Sair da conta"
    cy.contains('Sair da conta', { timeout: 10000 }).should('be.visible').click();

    // A UI deve voltar para "Entrar"
    cy.contains('Entrar').should('be.visible');
  });
});

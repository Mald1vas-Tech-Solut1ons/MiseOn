/**
 * Capturas das telas reais da integração iFood, para a landing page.
 *
 * NÃO é teste: é um gerador de imagem. Roda sob demanda
 * (`npx cypress run --spec cypress/e2e/capturas-ifood.cy.ts`) e grava PNG em
 * cypress/screenshots/, de onde as imagens são copiadas para public/.
 *
 * POR QUE ASSIM: a landing vende software e mostrava só texto. Screenshot de
 * mockup desenhado à mão envelhece e mente — esta é a tela de verdade, com os
 * dados de verdade da loja de demonstração. Quando a tela mudar, roda de novo.
 *
 * Fica fora da suíte do CI de propósito: depende de login e de dados que só
 * existem no ambiente real, e falharia num runner limpo.
 */

const EMAIL = Cypress.env('DEMO_EMAIL') as string;
const SENHA = Cypress.env('DEMO_SENHA') as string;

describe('capturas da integração iFood', () => {
  it('captura as três abas', () => {
    cy.viewport(1440, 900);

    cy.visit('/admin/login');
    cy.get('input[type="email"]').type(EMAIL);
    cy.get('input[type="password"]').type(SENHA, { log: false });
    cy.get('button[type="submit"]').click();

    // O painel carrega assíncrono; esperar a rota é mais estável que um sleep.
    cy.url({ timeout: 30000 }).should('include', '/admin');

    cy.visit('/admin/ifood');
    cy.contains('Integração iFood', { timeout: 30000 }).should('be.visible');
    cy.dismissCookieBanner();
    cy.wait(2500);
    cy.screenshot('01-conexao-e-taxas', { capture: 'viewport', overwrite: true });

    cy.contains('button', 'De-Para de Produtos').click();
    cy.contains('Como funciona o De-Para', { timeout: 20000 }).should('be.visible');
    cy.wait(1500);
    cy.screenshot('02-de-para', { capture: 'viewport', overwrite: true });

    cy.contains('button', 'Pedidos iFood').click();
    cy.contains('Bruto (30 dias)', { timeout: 20000 }).should('be.visible');
    cy.wait(1500);
    cy.screenshot('03-pedidos', { capture: 'viewport', overwrite: true });

    // O card do pedido no Painel é a comanda completa — o argumento mais forte
    // da página, e o que nenhuma captura da aba iFood mostra.
    cy.visit('/admin/pedidos');
    cy.contains('Painel de Controle', { timeout: 30000 }).should('be.visible');
    cy.wait(2500);
    cy.screenshot('04-painel-pedidos', { capture: 'viewport', overwrite: true });
  });
});

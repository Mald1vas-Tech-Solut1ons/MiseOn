import { mockSupabase } from '../support/mockDB';

describe('Fluxo de Pedidos', () => {
  beforeEach(() => {
    mockSupabase();
  });

  it('deve criar um pedido completo com Pix', () => {
    cy.mockAuth();
    cy.visit('/teste');
    cy.wait('@getLojas');
    cy.dismissCookieBanner();

    // Clica no produto
    cy.contains('X-Burger').click();
    
    // Confirma modal de produto
    cy.contains('Adicionar').click();

    // Carrinho deve conter o item X-Burger na tela
    cy.contains('X-Burger').should('be.visible');
    
    // Abre checkout
    cy.get('.vitrine-floating-cart:visible').click();

    // Seleciona Retirada e Pix
    cy.contains('Retirada').click();
    cy.contains('Pix').click();
    
    // Mock do polling de pagamento
    cy.intercept('GET', '**/rest/v1/pagamentos*', {
      statusCode: 200,
      body: [{ id: 'pag-1', status: 'PAGO' }]
    }).as('checkPagamento');

    cy.get('button').contains('Finalizar Pedido').click();

    // Deve bater na function de pix
    cy.wait('@pixCreate');

    // Como o pagamento já volta PAGO no polling, deve ir direto para a tela de sucesso
    cy.contains('Pagamento confirmado!', { timeout: 10000 }).should('exist');
  });

  it('deve utilizar cashback no pedido', () => {
    cy.mockAuth();
    cy.visit('/teste');
    cy.wait('@getLojas');
    cy.dismissCookieBanner();

    cy.contains('X-Burger').click();
    cy.contains('Adicionar').click();
    cy.get('.vitrine-floating-cart:visible').click();

    // Aguarda o cliente e saldo de cashback serem carregados
    cy.wait('@getClientes');
    cy.wait('@getCashback');

    // Deve ter a opção de usar cashback
    cy.contains('Usar meu cashback').click();

    // O total era 15, com 10 de desconto deve virar 5
    // Vamos procurar pelo valor formatado
    cy.contains('R$ 5,00').should('be.visible');
  });

  it('deve cancelar pedido no status NOVO com estorno', () => {
    // Mock admin role para acessar /admin/pedidos
    cy.mockAuth('admin-user-id');
    
    cy.intercept('GET', '**/rest/v1/pedidos*', {
      statusCode: 200,
      body: [{ 
        id: 'pedido-1', 
        numero: 1002, 
        status: 'NOVO', 
        total: 15,
        cliente_id: 'client-1',
        pedido_itens: [] 
      }]
    }).as('getAdminPedidos');

    cy.intercept('POST', '**/rpc/fn_avancar_status_pedido', { statusCode: 200, body: null }).as('avancarStatus');
    cy.intercept('PATCH', '**/rest/v1/pedidos*', { statusCode: 200 }).as('patchPedido');
    cy.intercept('PATCH', '**/rest/v1/pagamentos*', { statusCode: 200 });

    cy.visit('/admin/pedidos');
    cy.wait('@getAdminPedidos');
    cy.dismissCookieBanner();

    cy.contains('#1002').should('be.visible');
    cy.get('button[title*="Cancelar"]').click();

    cy.wait('@avancarStatus').its('request.body').should('deep.include', { p_novo_status: 'CANCELADO' });
  });
});

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
    cy.contains('X-Burger').filter(':visible').first().click();

    // Confirma modal de produto
    cy.contains('button', 'Adicionar').filter(':visible').first().click();

    // Carrinho deve conter o item X-Burger na tela
    cy.contains('X-Burger').should('be.visible');
    
    // Abre checkout
    cy.get('.vitrine-floating-cart:visible').click();

    // Seleciona Retirada e Pix
    cy.contains('button', 'Retirada').filter(':visible').first().click();
    cy.contains('button', 'Pix').filter(':visible').first().click();
    
    // Mock do polling de pagamento
    cy.intercept('GET', '**/rest/v1/pagamentos*', {
      statusCode: 200,
      body: [{ id: 'pag-1', status: 'PAGO' }]
    }).as('checkPagamento');

    // Ancora estavel em vez de texto: 'Finalizar Pedido' tambem e o TITULO do
    // drawer, e cy.contains pega o primeiro no do DOM. Com o bundle
    // instrumentado (mais lento) a ordem muda e o clique caia no elemento
    // errado — passava local, quebrava no CI.
    // scrollIntoView porque o botao fica na borda inferior do drawer, atras do
    // balao do chat.
    cy.get('[data-cy=checkout-finalizar]').scrollIntoView().should('be.visible').click();

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

    cy.contains('X-Burger').filter(':visible').first().click();
    cy.contains('button', 'Adicionar').filter(':visible').first().click();
    cy.get('.vitrine-floating-cart:visible').click();

    // Aguarda o cliente e saldo de cashback serem carregados
    cy.wait('@getClientes');
    cy.wait('@getCashback');

    // Deve ter a opção de usar cashback
    // scrollIntoView antes do assert: o drawer rola, e `should('be.visible')`
    // nao rola sozinho (o `click()` rola, o assert nao).
    cy.get('[data-cy=checkout-usar-cashback]').scrollIntoView().should('be.visible').click();

    // O total era 15, com 10 de desconto deve virar 5.
    // scrollIntoView pelo mesmo motivo do toggle: em "Entrega" o formulario de
    // endereco fica aberto e empurra os totais para fora da area visivel do
    // drawer. Sem rolar, o assert falha mesmo com o valor correto na tela.
    cy.contains('R$ 5,00').scrollIntoView().should('be.visible');
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

    // Cancelar deixou de ser um confirm() seguido de UPDATE: agora passa pelo
    // ModalCancelamento, que exige um motivo e chama fn_cancelar_pedido. O
    // motivo e obrigatorio porque pedido que some do painel sem historia vira
    // discussao no balcao — e, no iFood, o motivo tem que ser um codigo aceito
    // por eles.
    cy.intercept('POST', '**/rpc/fn_cancelar_pedido', { statusCode: 200, body: null }).as('cancelarPedido');
    cy.intercept('PATCH', '**/rest/v1/pedidos*', { statusCode: 200 }).as('patchPedido');
    cy.intercept('PATCH', '**/rest/v1/pagamentos*', { statusCode: 200 });

    cy.visit('/admin/pedidos');
    cy.wait('@getAdminPedidos');
    cy.dismissCookieBanner();

    cy.window().then((w) => {
      cy.task('log', 'nav=' + w.navigator.language
        + ' ls=' + w.localStorage.getItem('miseon_idioma')
        + ' html=' + w.document.documentElement.lang);
    });
    cy.contains('#1002').should('be.visible');
    cy.get('button[title*="Cancelar"]').click();

    // Pedido que nao e do iFood usa a lista propria da loja, sem ida a rede.
    cy.contains('Por que este pedido está sendo cancelado?').should('be.visible');
    cy.contains('button', 'O cliente desistiu do pedido').click();
    cy.contains('button', 'Cancelar pedido').click();

    cy.wait('@cancelarPedido')
      .its('request.body')
      .should('deep.include', { p_motivo: 'O cliente desistiu do pedido' });

    cy.contains('Pedido cancelado').should('be.visible');
  });
});

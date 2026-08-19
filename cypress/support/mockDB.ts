export const mockSupabase = () => {
  cy.intercept('GET', '**/rest/v1/lojas*', {
    statusCode: 200,
    body: [{
      id: 'mock-loja-1',
      nome: 'Loja Teste',
      slug: 'teste',
      cor_primaria: '#FF0000',
      aberto_manual: true,
      pedido_minimo: 0,
      endereco: 'Rua de Teste, 123'
    }]
  }).as('getLojas');

  cy.intercept('GET', '**/rest/v1/lojas_publicas*', {
    statusCode: 200,
    body: {
      id: 'mock-loja-1',
      nome: 'Loja Teste',
      slug: 'teste',
      cor_primaria: '#FF0000',
      aberto_manual: true,
      pedido_minimo: 0,
      endereco: 'Rua de Teste, 123'
    }
  }).as('getLojas');

  cy.intercept('GET', '**/rest/v1/usuarios_loja*', {
    statusCode: 200,
    body: [{
      loja_id: 'mock-loja-1',
      papel: 'admin',
      lojas: {
        nome: 'Loja Teste',
        cor_primaria: '#FF0000',
        cor_secundaria: '#0000FF',
        slug: 'teste',
        criado_em: new Date().toISOString(),
        status_assinatura: 'ativa',
        trial_termina_em: null,
        segmento_negocio: 'restaurante',
        modulos_ativos: {}
      }
    }]
  }).as('getUsuariosLoja');

  cy.intercept('GET', '**/rest/v1/horarios_funcionamento*', { body: [] });
  cy.intercept('GET', '**/rest/v1/banners_destaque*', { body: [] });
  cy.intercept('GET', '**/rest/v1/categorias*', { 
    body: [{ id: 'cat-1', nome: 'Lanches', ordem: 1 }] 
  });
  
  cy.intercept('GET', '**/rest/v1/produtos*', { 
    body: [{
      id: 'prod-1',
      nome: 'X-Burger',
      descricao: 'Hamburguer simples',
      preco: 15.00,
      categoria_id: 'cat-1',
      grupos_opcoes: [],
      tem_estoque: true
    }] 
  });
  
  cy.intercept('GET', '**/rest/v1/taxas_entrega*', { body: [] });
  cy.intercept('GET', '**/rest/v1/faixas_entrega*', { body: [] });
  cy.intercept('POST', '**/rpc/fn_produtos_com_estoque', { 
    body: [{ produto_id: 'prod-1', tem_estoque: true }] 
  });
  
  cy.intercept('GET', '**/rest/v1/clientes*', {
    body: [{ id: 'client-1', user_id: '00000000-0000-0000-0000-000000000000', nome: 'Test User', telefone: '11999999999', saldo_cashback: 10.00 }]
  }).as('getClientes');

  cy.intercept('GET', '**/rest/v1/enderecos_cliente*', { body: [] });
  cy.intercept('GET', '**/rest/v1/favoritos_cliente*', { body: [] });
  cy.intercept('GET', '**/rest/v1/pedidos*', { body: [] });

  cy.intercept('POST', '**/rest/v1/clientes*', {
    statusCode: 200,
    body: { id: 'client-1' }
  });

  cy.intercept('GET', '**/rest/v1/cashback_saldos*', {
    body: [{ saldo: 10.00 }]
  }).as('getCashback');

  cy.intercept('POST', '**/rpc/fn_usar_cashback', {
    body: true
  });

  // Checkout: o pedido inteiro nasce numa transacao no banco
  // (fn_criar_pedido_completo). Antes o drawer fazia sete POSTs sequenciais e o
  // mock precisava interceptar cada tabela; agora e uma chamada so.
  cy.intercept('POST', '**/rpc/fn_criar_pedido_completo', {
    statusCode: 200,
    body: { pedido_id: 'pedido-1', numero: 1001, valor_total: 15 }
  }).as('createPedido');

  // Os POSTs de tabela seguem mockados: o PDV e o fluxo de mesa ainda escrevem
  // direto, e sem isto uma chamada real vazaria para o Supabase de placeholder.
  cy.intercept('POST', '**/rest/v1/pedidos*', {
    statusCode: 201,
    body: { id: 'pedido-1', numero: 1001 }
  });

  cy.intercept('POST', '**/rest/v1/itens_pedido*', {
    statusCode: 201,
    body: { id: 'item-1' }
  });

  cy.intercept('POST', '**/rest/v1/pagamentos*', {
    statusCode: 201,
    body: [{ id: 'pag-1' }]
  });
  
  // Edge Function mock for PIX
  cy.intercept('POST', '**/functions/v1/pix-criar-cobranca', {
    statusCode: 200,
    body: {
      copia_e_cola: '00020126580014br.gov.bcb.pix...',
      qr_imagem: 'data:image/png;base64,...'
    }
  }).as('pixCreate');

  // Edge function mock for Card
  cy.intercept('POST', '**/functions/v1/cartao-pagar', {
    statusCode: 200,
    body: { success: true }
  }).as('cardPay');
};

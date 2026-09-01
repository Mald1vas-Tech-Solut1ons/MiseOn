import '@cypress/code-coverage/support';

declare global {
  namespace Cypress {
    interface Chainable {
      mockAuth(userId?: string): Chainable<void>;
      dismissCookieBanner(): Chainable<void>;
    }
  }
}

// Dispensa o banner de LGPD por `data-testid`, NAO por texto.
//
// A versao anterior procurava o titulo em portugues. Quando o app subia em
// ingles (runner do CI, `navigator.language`), o `includes` dava falso, o
// helper achava que nao havia banner e seguia — mas o banner continuava na
// tela, cobrindo o rodape do carrinho e o rodape dos modais. O teste entao
// falhava la na frente, num assert que nada tinha a ver com cookie.
//
// A suite hoje fixa pt-BR (ver support/e2e.ts); o testid e a segunda barreira,
// para que uma troca de copy ou de idioma nao derrube o E2E de novo.
Cypress.Commands.add('dismissCookieBanner', () => {
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="cookie-aceitar-todos"]').length) {
      cy.get('[data-testid="cookie-aceitar-todos"]').click();
      cy.get('[data-testid="cookie-aceitar-todos"]').should('not.exist');
    }
  });
});

Cypress.Commands.add('mockAuth', (userId = '00000000-0000-0000-0000-000000000000') => {
  const session = {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Test User' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  cy.window().then((win) => {
    const sessionStr = JSON.stringify(session);
    win.localStorage.setItem('sb-placeholder-auth-token', sessionStr);
    win.localStorage.setItem('sb-zzuxklwhaoisuuvndtfw-auth-token', sessionStr);
    win.localStorage.setItem('sb-uvthidnqmezmmdrteqks-auth-token', sessionStr);
    
    // Set for any project ref from env if available
    const envUrl = Cypress.env('VITE_SUPABASE_URL') || '';
    const match = /https:\/\/([^.]+)\.supabase\.co/.exec(envUrl);
    if (match?.[1]) {
      win.localStorage.setItem(`sb-${match[1]}-auth-token`, sessionStr);
    }
  });

  // Intercept all Supabase Auth endpoints so SDK never makes real network calls
  cy.intercept('GET', '**/auth/v1/user*', {
    statusCode: 200,
    body: session.user,
  }).as('getUser');

  cy.intercept('POST', '**/auth/v1/token*', {
    statusCode: 200,
    body: session,
  }).as('postToken');

  cy.intercept('GET', '**/auth/v1/session*', {
    statusCode: 200,
    body: session,
  }).as('getSession');

  cy.intercept('POST', '**/auth/v1/signout*', {
    statusCode: 204,
    body: {},
  }).as('postSignout');

  cy.intercept('POST', '**/auth/v1/logout*', {
    statusCode: 204,
    body: {},
  }).as('postLogout');
});

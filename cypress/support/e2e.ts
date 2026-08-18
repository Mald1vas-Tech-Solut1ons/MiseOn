import './commands';
import '@cypress/code-coverage/support';

beforeEach(() => {
  cy.window().then((win) => {
    win.localStorage.setItem(
      'miseon_cookie_consent_v1',
      JSON.stringify({
        tipo: 'aceito_todos',
        preferencias: { essenciais: true, analiticos: true, marketing: true },
        atualizadoEm: new Date().toISOString(),
      })
    );
  });
});

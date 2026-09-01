import { defineConfig } from 'cypress';
import coverageTask from '@cypress/code-coverage/task';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:4173',
    // `capturas-*.cy.ts` nao sao testes: sao geradores de imagem para a landing.
    // Dependem de login e de dados que so existem no ambiente real, entao no
    // runner limpo do CI eles falhariam e derrubariam o job inteiro. Rodam sob
    // demanda, com --spec.
    excludeSpecPattern: ['**/capturas-*.cy.ts'],
    viewportWidth: 1280,
    viewportHeight: 800,
    // O runner do GitHub Actions e bem mais lento que a maquina local, e no
    // job de E2E o bundle vai INSTRUMENTADO (CYPRESS_COVERAGE=true), o que
    // pesa mais ainda. Com os 4s padrao, assert de elemento que depende de
    // fetch fica na corrida — passa local e falha no CI.
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 90000,
    setupNodeEvents(on, config) {
      coverageTask(on, config);
      on('task', { log(m: string) { console.log('[DIAG] ' + m); return null; } });
      return config;
    },
    retries: {
      runMode: 2,
      openMode: 0
    },
    video: false,
    screenshotOnRunFailure: true
  }
});

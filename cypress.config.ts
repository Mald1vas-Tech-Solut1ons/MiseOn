import { defineConfig } from 'cypress';
import coverageTask from '@cypress/code-coverage/task';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:4173',
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

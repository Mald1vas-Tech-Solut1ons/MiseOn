import { defineConfig } from 'cypress';
import coverageTask from '@cypress/code-coverage/task';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:4173',
    viewportWidth: 1280,
    viewportHeight: 800,
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

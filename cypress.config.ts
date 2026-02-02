import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'https://fcdo--dev.sandbox.lightning.force.com',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 30000,
    pageLoadTimeout: 60000,
    requestTimeout: 30000,
    responseTimeout: 30000,
    video: true,
    screenshotOnRunFailure: true,
    chromeWebSecurity: false,
    experimentalModifyObstructiveThirdPartyCode: true,

    env: {
      // Salesforce credentials - set via environment variables
      SF_USERNAME: process.env.SF_USERNAME,
      SF_PASSWORD: process.env.SF_PASSWORD,
      SF_LOGIN_URL: process.env.SF_LOGIN_URL || 'https://fcdo--dev.sandbox.my.salesforce.com',
    },

    retries: {
      runMode: 2,
      openMode: 0,
    },

    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
      });

      return config;
    },
  },

  // Component testing configuration (if needed for LWC)
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
  },
});

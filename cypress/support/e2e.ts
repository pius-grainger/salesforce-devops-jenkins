// ***********************************************************
// This file is processed and loaded automatically before test files.
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import './commands';

// Prevent Cypress from failing on uncaught exceptions from Salesforce
Cypress.on('uncaught:exception', (err) => {
  // Salesforce Lightning throws various errors that we can safely ignore
  if (
    err.message.includes('Cannot read properties of null') ||
    err.message.includes('Cannot read properties of undefined') ||
    err.message.includes('ResizeObserver loop') ||
    err.message.includes('Script error')
  ) {
    return false;
  }
  return true;
});

// Log test start
beforeEach(() => {
  cy.log(`Running: ${Cypress.currentTest.title}`);
});

// Log test completion
afterEach(function () {
  if (this.currentTest?.state === 'failed') {
    cy.log(`FAILED: ${Cypress.currentTest.title}`);
  }
});

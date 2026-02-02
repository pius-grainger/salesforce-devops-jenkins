// ***********************************************
// Custom Cypress commands for Salesforce testing
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login to Salesforce
       * @param username - Salesforce username
       * @param password - Salesforce password
       */
      sfLogin(username?: string, password?: string): Chainable<void>;

      /**
       * Navigate to a Salesforce object list
       * @param objectName - API name of the object
       */
      sfNavigateToObject(objectName: string): Chainable<void>;

      /**
       * Create a new record
       * @param objectName - API name of the object
       * @param recordData - Field values for the new record
       */
      sfCreateRecord(objectName: string, recordData: Record<string, string>): Chainable<void>;

      /**
       * Wait for Lightning page to load
       */
      sfWaitForPageLoad(): Chainable<void>;

      /**
       * Click a Lightning button by label
       * @param label - Button label text
       */
      sfClickButton(label: string): Chainable<void>;

      /**
       * Set a Lightning input field
       * @param fieldLabel - Label of the field
       * @param value - Value to set
       */
      sfSetField(fieldLabel: string, value: string): Chainable<void>;

      /**
       * Get record ID from current URL
       */
      sfGetRecordId(): Chainable<string>;
    }
  }
}

// Salesforce Login
Cypress.Commands.add('sfLogin', (username?: string, password?: string) => {
  const user = username || Cypress.env('SF_USERNAME');
  const pass = password || Cypress.env('SF_PASSWORD');
  const loginUrl = Cypress.env('SF_LOGIN_URL');

  cy.session(
    [user],
    () => {
      cy.visit(loginUrl);
      cy.get('#username').type(user);
      cy.get('#password').type(pass, { log: false });
      cy.get('#Login').click();

      // Wait for redirect to Lightning
      cy.url().should('include', 'lightning', { timeout: 60000 });
    },
    {
      validate: () => {
        cy.visit('/lightning/page/home');
        cy.url().should('include', 'lightning');
      },
      cacheAcrossSpecs: true,
    }
  );
});

// Navigate to object list
Cypress.Commands.add('sfNavigateToObject', (objectName: string) => {
  cy.visit(`/lightning/o/${objectName}/list`);
  cy.sfWaitForPageLoad();
});

// Create new record
Cypress.Commands.add('sfCreateRecord', (objectName: string, recordData: Record<string, string>) => {
  cy.sfNavigateToObject(objectName);
  cy.sfClickButton('New');

  // Wait for modal to open
  cy.get('.slds-modal__container', { timeout: 10000 }).should('be.visible');

  // Fill in fields
  Object.entries(recordData).forEach(([field, value]) => {
    cy.sfSetField(field, value);
  });

  // Save
  cy.sfClickButton('Save');
  cy.sfWaitForPageLoad();
});

// Wait for Lightning page to load
Cypress.Commands.add('sfWaitForPageLoad', () => {
  // Wait for spinner to disappear
  cy.get('.slds-spinner_container', { timeout: 5000 }).should('not.exist');

  // Wait for page content
  cy.get('.slds-page-header, .forceHighlightsPanel', { timeout: 30000 }).should('exist');
});

// Click Lightning button
Cypress.Commands.add('sfClickButton', (label: string) => {
  cy.contains('button, a.slds-button', label, { timeout: 10000 })
    .should('be.visible')
    .click();
});

// Set Lightning field
Cypress.Commands.add('sfSetField', (fieldLabel: string, value: string) => {
  cy.contains('label, span.slds-form-element__label', fieldLabel)
    .parent()
    .find('input, textarea, select')
    .first()
    .clear()
    .type(value);
});

// Get record ID from URL
Cypress.Commands.add('sfGetRecordId', () => {
  return cy.url().then((url) => {
    const match = url.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
    return match ? match[1] : '';
  });
});

export {};

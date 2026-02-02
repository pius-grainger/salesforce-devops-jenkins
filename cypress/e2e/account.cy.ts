/**
 * E2E Tests for Account functionality
 *
 * These tests validate core Account operations through the Salesforce Lightning UI.
 * Requires valid Salesforce credentials set via environment variables.
 */

describe('Account Management', () => {
  beforeEach(() => {
    cy.sfLogin();
  });

  describe('Account List View', () => {
    it('should navigate to Accounts list', () => {
      cy.sfNavigateToObject('Account');
      cy.contains('Accounts').should('be.visible');
      cy.get('.slds-page-header__title').should('contain', 'Accounts');
    });

    it('should display Account records in list', () => {
      cy.sfNavigateToObject('Account');

      // Wait for list to load
      cy.get('table.slds-table, lightning-datatable', { timeout: 30000 }).should('exist');
    });

    it('should be able to search for Accounts', () => {
      cy.sfNavigateToObject('Account');

      // Find and use search input
      cy.get('input[placeholder*="Search"]')
        .should('be.visible')
        .type('Test Account{enter}');

      cy.sfWaitForPageLoad();
    });
  });

  describe('Account Creation', () => {
    const testAccountName = `Cypress Test Account ${Date.now()}`;

    it('should create a new Account', () => {
      cy.sfNavigateToObject('Account');
      cy.sfClickButton('New');

      // Wait for modal
      cy.get('.slds-modal__container', { timeout: 10000 }).should('be.visible');

      // Fill in Account Name
      cy.get('input[name="Name"]').type(testAccountName);

      // Select Account Type
      cy.get('button[name="Type"]').click();
      cy.contains('lightning-base-combobox-item', 'Customer').click();

      // Select Industry
      cy.get('button[name="Industry"]').click();
      cy.contains('lightning-base-combobox-item', 'Government').click();

      // Fill in Billing Address
      cy.get('textarea[name="street"]').type('123 Test Street');
      cy.get('input[name="city"]').type('London');
      cy.get('input[name="postalCode"]').type('SW1A 1AA');
      cy.get('input[name="country"]').type('United Kingdom');

      // Save
      cy.sfClickButton('Save');

      // Verify success toast
      cy.contains('.toastMessage', 'was created', { timeout: 10000 }).should('be.visible');

      // Verify we're on the record page
      cy.url().should('match', /\/Account\/[a-zA-Z0-9]{18}\//);

      // Verify Account name is displayed
      cy.contains(testAccountName).should('be.visible');
    });

    after(() => {
      // Cleanup: Delete test Account
      cy.task('log', `Note: Test Account "${testAccountName}" should be deleted manually or via data cleanup`);
    });
  });

  describe('Account Detail View', () => {
    it('should view Account details', () => {
      cy.sfNavigateToObject('Account');

      // Click on first Account in list
      cy.get('table.slds-table tbody tr, lightning-datatable tbody tr')
        .first()
        .find('a[data-refid="recordId"]')
        .first()
        .click();

      cy.sfWaitForPageLoad();

      // Verify detail page elements
      cy.get('.forceHighlightsPanel, .slds-page-header').should('be.visible');
    });

    it('should edit an Account', () => {
      cy.sfNavigateToObject('Account');

      // Navigate to first Account
      cy.get('table.slds-table tbody tr, lightning-datatable tbody tr')
        .first()
        .find('a[data-refid="recordId"]')
        .first()
        .click();

      cy.sfWaitForPageLoad();

      // Click Edit button
      cy.sfClickButton('Edit');

      // Wait for edit modal
      cy.get('.slds-modal__container', { timeout: 10000 }).should('be.visible');

      // Make a change (update description)
      cy.get('textarea[name="Description"]')
        .clear()
        .type(`Updated by Cypress E2E test on ${new Date().toISOString()}`);

      // Save
      cy.sfClickButton('Save');

      // Verify success
      cy.contains('.toastMessage', 'was saved', { timeout: 10000 }).should('be.visible');
    });
  });

  describe('Account Related Lists', () => {
    it('should view Contacts related list', () => {
      cy.sfNavigateToObject('Account');

      // Navigate to first Account
      cy.get('table.slds-table tbody tr, lightning-datatable tbody tr')
        .first()
        .find('a[data-refid="recordId"]')
        .first()
        .click();

      cy.sfWaitForPageLoad();

      // Find Related tab or section
      cy.contains('button, a', 'Related').click();

      // Verify Contacts related list is visible
      cy.contains('Contacts').should('be.visible');
    });
  });
});

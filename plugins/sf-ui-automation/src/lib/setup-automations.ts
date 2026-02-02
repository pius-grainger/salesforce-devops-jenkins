import { Page } from 'puppeteer';
import { BrowserManager, SalesforceUI } from './browser.js';

/**
 * SetupAutomations provides methods for configuring Salesforce features
 * that are not available through the Metadata API or Tooling API.
 */
export class SetupAutomations {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * Enable/disable Einstein Activity Capture
   */
  async configureEinsteinActivityCapture(
    page: Page,
    options: {
      enabled: boolean;
      captureEmails?: boolean;
      captureEvents?: boolean;
    }
  ): Promise<void> {
    console.log('Configuring Einstein Activity Capture...');

    await this.browserManager.navigateToSetup(page, 'ActivitySyncEngineSettings');
    const setupPage = await this.browserManager.getSetupIframe(page);

    // Toggle main switch
    const toggleSelector = 'input[type="checkbox"][id*="activityCapture"]';
    await SalesforceUI.setCheckbox(setupPage, toggleSelector, options.enabled);

    if (options.enabled) {
      if (options.captureEmails !== undefined) {
        await SalesforceUI.setCheckbox(
          setupPage,
          'input[type="checkbox"][id*="emailCapture"]',
          options.captureEmails
        );
      }

      if (options.captureEvents !== undefined) {
        await SalesforceUI.setCheckbox(
          setupPage,
          'input[type="checkbox"][id*="eventCapture"]',
          options.captureEvents
        );
      }
    }

    await SalesforceUI.clickButton(setupPage, 'Save');
    await SalesforceUI.waitForToast(setupPage);
    console.log('Einstein Activity Capture configured successfully');
  }

  /**
   * Configure Session Settings
   */
  async configureSessionSettings(
    page: Page,
    options: {
      sessionTimeout?: number;
      forceLogoutOnSessionTimeout?: boolean;
      lockSessionsToIp?: boolean;
      requireHttpOnly?: boolean;
      requireSecureConnections?: boolean;
      enableCspOnEmail?: boolean;
    }
  ): Promise<void> {
    console.log('Configuring Session Settings...');

    await this.browserManager.navigateToSetup(page, 'SecuritySession');
    const setupPage = await this.browserManager.getSetupIframe(page);

    // Click Edit button
    await SalesforceUI.clickButton(setupPage, 'Edit');
    await page.waitForNetworkIdle({ idleTime: 500 });

    if (options.sessionTimeout !== undefined) {
      await SalesforceUI.selectOption(
        setupPage,
        'select[id*="timeout"]',
        options.sessionTimeout.toString()
      );
    }

    if (options.forceLogoutOnSessionTimeout !== undefined) {
      await SalesforceUI.setCheckbox(
        setupPage,
        'input[type="checkbox"][id*="forceLogout"]',
        options.forceLogoutOnSessionTimeout
      );
    }

    if (options.lockSessionsToIp !== undefined) {
      await SalesforceUI.setCheckbox(
        setupPage,
        'input[type="checkbox"][id*="lockIp"]',
        options.lockSessionsToIp
      );
    }

    if (options.requireHttpOnly !== undefined) {
      await SalesforceUI.setCheckbox(
        setupPage,
        'input[type="checkbox"][id*="httpOnly"]',
        options.requireHttpOnly
      );
    }

    if (options.requireSecureConnections !== undefined) {
      await SalesforceUI.setCheckbox(
        setupPage,
        'input[type="checkbox"][id*="secureConnections"]',
        options.requireSecureConnections
      );
    }

    await SalesforceUI.clickButton(setupPage, 'Save');
    await SalesforceUI.waitForToast(setupPage);
    console.log('Session Settings configured successfully');
  }

  /**
   * Configure Organization-Wide Email Addresses
   */
  async configureOrgWideEmailAddress(
    page: Page,
    options: {
      displayName: string;
      emailAddress: string;
      allowAllProfiles: boolean;
    }
  ): Promise<void> {
    console.log('Configuring Org-Wide Email Address...');

    await this.browserManager.navigateToSetup(page, 'OrgWideEmailAddresses');
    const setupPage = await this.browserManager.getSetupIframe(page);

    // Click Add button
    await SalesforceUI.clickButton(setupPage, 'Add');
    await page.waitForNetworkIdle({ idleTime: 500 });

    // Fill in email details
    await SalesforceUI.setInput(
      setupPage,
      'input[id*="displayName"]',
      options.displayName
    );

    await SalesforceUI.setInput(
      setupPage,
      'input[id*="emailAddress"]',
      options.emailAddress
    );

    if (options.allowAllProfiles) {
      await SalesforceUI.setCheckbox(
        setupPage,
        'input[type="checkbox"][id*="allowAll"]',
        true
      );
    }

    await SalesforceUI.clickButton(setupPage, 'Save');
    await SalesforceUI.waitForToast(setupPage);
    console.log('Org-Wide Email Address configured successfully');
  }

  /**
   * Enable/configure Omni-Channel settings
   */
  async configureOmniChannel(
    page: Page,
    options: {
      enabled: boolean;
      enableSkillBasedRouting?: boolean;
      enableExternalRouting?: boolean;
    }
  ): Promise<void> {
    console.log('Configuring Omni-Channel...');

    await this.browserManager.navigateToSetup(page, 'OmniChannelSettings');
    const setupPage = await this.browserManager.getSetupIframe(page);

    await SalesforceUI.setCheckbox(
      setupPage,
      'input[type="checkbox"][id*="enableOmni"]',
      options.enabled
    );

    if (options.enabled) {
      if (options.enableSkillBasedRouting !== undefined) {
        await SalesforceUI.setCheckbox(
          setupPage,
          'input[type="checkbox"][id*="skillBased"]',
          options.enableSkillBasedRouting
        );
      }

      if (options.enableExternalRouting !== undefined) {
        await SalesforceUI.setCheckbox(
          setupPage,
          'input[type="checkbox"][id*="externalRouting"]',
          options.enableExternalRouting
        );
      }
    }

    await SalesforceUI.clickButton(setupPage, 'Save');
    await SalesforceUI.waitForToast(setupPage);
    console.log('Omni-Channel configured successfully');
  }

  /**
   * Configure Identity Provider settings
   */
  async configureIdentityProvider(
    page: Page,
    options: {
      enabled: boolean;
      certificateName?: string;
    }
  ): Promise<void> {
    console.log('Configuring Identity Provider...');

    await this.browserManager.navigateToSetup(page, 'IdpPage');
    const setupPage = await this.browserManager.getSetupIframe(page);

    if (options.enabled) {
      await SalesforceUI.clickButton(setupPage, 'Enable Identity Provider');
      await page.waitForNetworkIdle({ idleTime: 1000 });

      if (options.certificateName) {
        await SalesforceUI.selectOption(
          setupPage,
          'select[id*="certificate"]',
          options.certificateName
        );
      }

      await SalesforceUI.clickButton(setupPage, 'Save');
    } else {
      await SalesforceUI.clickButton(setupPage, 'Disable');
      await SalesforceUI.confirmDialog(setupPage, true);
    }

    await SalesforceUI.waitForToast(setupPage);
    console.log('Identity Provider configured successfully');
  }

  /**
   * Configure sharing settings for an object
   */
  async configureOrgWideDefaults(
    page: Page,
    options: {
      objectName: string;
      internalAccess: 'Private' | 'Public Read Only' | 'Public Read/Write' | 'Controlled by Parent';
      externalAccess?: 'Private' | 'Public Read Only' | 'Public Read/Write';
      grantAccessUsingHierarchies?: boolean;
    }
  ): Promise<void> {
    console.log(`Configuring OWD for ${options.objectName}...`);

    await this.browserManager.navigateToSetup(page, 'SecuritySharing');
    const setupPage = await this.browserManager.getSetupIframe(page);

    // Click Edit for the specific object
    const objectRow = await setupPage.waitForSelector(
      `tr:has-text("${options.objectName}")`
    );
    await objectRow?.evaluate((row) => {
      const editLink = row.querySelector('a:has-text("Edit")');
      (editLink as HTMLElement)?.click();
    });

    await page.waitForNetworkIdle({ idleTime: 500 });

    // Set internal access
    await SalesforceUI.selectOption(
      setupPage,
      'select[id*="internalAccess"]',
      options.internalAccess
    );

    // Set external access if provided
    if (options.externalAccess) {
      await SalesforceUI.selectOption(
        setupPage,
        'select[id*="externalAccess"]',
        options.externalAccess
      );
    }

    // Grant access using hierarchies
    if (options.grantAccessUsingHierarchies !== undefined) {
      await SalesforceUI.setCheckbox(
        setupPage,
        'input[type="checkbox"][id*="hierarchy"]',
        options.grantAccessUsingHierarchies
      );
    }

    await SalesforceUI.clickButton(setupPage, 'Save');
    await SalesforceUI.waitForToast(setupPage);
    console.log(`OWD configured for ${options.objectName}`);
  }

  /**
   * Configure Data Loader settings
   */
  async configureDataLoaderSettings(
    page: Page,
    options: {
      enableBulkApi?: boolean;
      enableBulkApiSerialMode?: boolean;
      batchSize?: number;
    }
  ): Promise<void> {
    console.log('Configuring Data Loader Settings...');

    await this.browserManager.navigateToSetup(page, 'DataLoaderSettings');
    const setupPage = await this.browserManager.getSetupIframe(page);

    await SalesforceUI.clickButton(setupPage, 'Edit');
    await page.waitForNetworkIdle({ idleTime: 500 });

    if (options.enableBulkApi !== undefined) {
      await SalesforceUI.setCheckbox(
        setupPage,
        'input[type="checkbox"][id*="bulkApi"]',
        options.enableBulkApi
      );
    }

    if (options.enableBulkApiSerialMode !== undefined) {
      await SalesforceUI.setCheckbox(
        setupPage,
        'input[type="checkbox"][id*="serialMode"]',
        options.enableBulkApiSerialMode
      );
    }

    if (options.batchSize !== undefined) {
      await SalesforceUI.setInput(
        setupPage,
        'input[id*="batchSize"]',
        options.batchSize.toString()
      );
    }

    await SalesforceUI.clickButton(setupPage, 'Save');
    await SalesforceUI.waitForToast(setupPage);
    console.log('Data Loader Settings configured successfully');
  }

  /**
   * Activate/deactivate a Flow
   */
  async activateFlow(
    page: Page,
    options: {
      flowApiName: string;
      activate: boolean;
    }
  ): Promise<void> {
    console.log(`${options.activate ? 'Activating' : 'Deactivating'} Flow: ${options.flowApiName}...`);

    await this.browserManager.navigateToSetup(page, `Flows/home`);
    await page.waitForNetworkIdle({ idleTime: 1000 });

    // Search for the flow
    const searchInput = await page.waitForSelector('input[placeholder*="Search"]');
    await searchInput?.type(options.flowApiName);
    await page.keyboard.press('Enter');
    await page.waitForNetworkIdle({ idleTime: 500 });

    // Click on the flow row dropdown
    const flowRow = await page.waitForSelector(`tr:has-text("${options.flowApiName}")`);
    const dropdown = await flowRow?.$('button[class*="rowActions"]');
    await dropdown?.click();

    // Click Activate/Deactivate
    const actionLabel = options.activate ? 'Activate' : 'Deactivate';
    await page.click(`a:has-text("${actionLabel}")`);

    // Confirm if needed
    const confirmBtn = await page.$('button:has-text("Confirm"), button:has-text("OK")');
    if (confirmBtn) {
      await confirmBtn.click();
    }

    await SalesforceUI.waitForToast(page);
    console.log(`Flow ${options.flowApiName} ${options.activate ? 'activated' : 'deactivated'}`);
  }

  /**
   * Configure Platform Event settings
   */
  async configurePlatformEventRetention(
    page: Page,
    options: {
      eventApiName: string;
      retentionDays: number;
    }
  ): Promise<void> {
    console.log(`Configuring retention for Platform Event: ${options.eventApiName}...`);

    await this.browserManager.navigateToSetup(page, `PlatformEvents/${options.eventApiName}`);
    const setupPage = await this.browserManager.getSetupIframe(page);

    await SalesforceUI.clickButton(setupPage, 'Edit');
    await page.waitForNetworkIdle({ idleTime: 500 });

    await SalesforceUI.setInput(
      setupPage,
      'input[id*="retention"]',
      options.retentionDays.toString()
    );

    await SalesforceUI.clickButton(setupPage, 'Save');
    await SalesforceUI.waitForToast(setupPage);
    console.log(`Platform Event retention configured for ${options.eventApiName}`);
  }
}

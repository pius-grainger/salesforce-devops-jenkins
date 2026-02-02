import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import { Connection, Org } from '@salesforce/core';

export interface BrowserOptions {
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
  viewport?: { width: number; height: number };
}

export interface SalesforceSession {
  browser: Browser;
  page: Page;
  instanceUrl: string;
  accessToken: string;
}

const DEFAULT_OPTIONS: BrowserOptions = {
  headless: true,
  slowMo: 50,
  timeout: 60000,
  viewport: { width: 1920, height: 1080 },
};

/**
 * BrowserManager handles Puppeteer browser lifecycle and Salesforce authentication
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: BrowserOptions;

  constructor(options: BrowserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Launch browser and authenticate to Salesforce using session
   */
  async connect(org: Org): Promise<SalesforceSession> {
    const connection = org.getConnection();
    const instanceUrl = connection.instanceUrl;
    const accessToken = connection.accessToken;

    if (!instanceUrl || !accessToken) {
      throw new Error('Unable to get Salesforce session. Please authenticate first.');
    }

    // Launch browser
    const launchOptions: PuppeteerLaunchOptions = {
      headless: this.options.headless ? 'new' : false,
      slowMo: this.options.slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        `--window-size=${this.options.viewport?.width},${this.options.viewport?.height}`,
      ],
    };

    this.browser = await puppeteer.launch(launchOptions);
    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewport({
      width: this.options.viewport?.width || 1920,
      height: this.options.viewport?.height || 1080,
    });

    // Set default timeout
    this.page.setDefaultTimeout(this.options.timeout || 60000);

    // Authenticate using frontdoor.jsp with session token
    const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${accessToken}`;
    await this.page.goto(frontdoorUrl, { waitUntil: 'networkidle2' });

    // Verify we're logged in by checking for Lightning or Classic
    const isLoggedIn = await this.page.evaluate(() => {
      return document.querySelector('.slds-global-header') !== null ||
             document.querySelector('#phHeaderLogoImage') !== null;
    });

    if (!isLoggedIn) {
      throw new Error('Failed to authenticate to Salesforce');
    }

    return {
      browser: this.browser,
      page: this.page,
      instanceUrl,
      accessToken,
    };
  }

  /**
   * Navigate to a Setup page
   */
  async navigateToSetup(page: Page, setupPath: string): Promise<void> {
    const setupUrl = await this.getSetupUrl(page, setupPath);
    await page.goto(setupUrl, { waitUntil: 'networkidle2' });
    await this.waitForSetupPageLoad(page);
  }

  /**
   * Get the full URL for a Setup page
   */
  private async getSetupUrl(page: Page, setupPath: string): Promise<string> {
    const currentUrl = page.url();
    const baseUrl = new URL(currentUrl).origin;

    // Handle both Lightning and Classic setup paths
    if (setupPath.startsWith('/lightning/')) {
      return `${baseUrl}${setupPath}`;
    }

    // Convert to Lightning Setup URL format
    return `${baseUrl}/lightning/setup/${setupPath}/home`;
  }

  /**
   * Wait for Setup page to fully load
   */
  async waitForSetupPageLoad(page: Page): Promise<void> {
    // Wait for spinner to disappear
    await page.waitForSelector('.slds-spinner', { hidden: true, timeout: 30000 }).catch(() => {});

    // Wait for main content to load
    await page.waitForSelector('.setupcontent, .setup-content, [class*="setup"]', {
      timeout: 30000,
    }).catch(() => {});

    // Additional wait for dynamic content
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {});
  }

  /**
   * Handle iframe navigation (common in Setup pages)
   */
  async getSetupIframe(page: Page): Promise<Page> {
    // Many Setup pages use iframes
    const iframeHandle = await page.$('iframe[name="setupFrame"], iframe.setupFrame');

    if (iframeHandle) {
      const frame = await iframeHandle.contentFrame();
      if (frame) {
        return frame as unknown as Page;
      }
    }

    return page;
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(page: Page, filename: string): Promise<void> {
    await page.screenshot({
      path: filename,
      fullPage: true,
    });
  }

  /**
   * Close browser
   */
  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

/**
 * Helper functions for common Salesforce UI interactions
 */
export const SalesforceUI = {
  /**
   * Click a Lightning button by its label
   */
  async clickButton(page: Page, label: string): Promise<void> {
    const button = await page.waitForSelector(
      `button:has-text("${label}"), lightning-button:has-text("${label}"), a.slds-button:has-text("${label}")`
    );
    await button?.click();
  },

  /**
   * Set a text input field
   */
  async setInput(page: Page, selector: string, value: string): Promise<void> {
    await page.waitForSelector(selector);
    await page.click(selector, { clickCount: 3 }); // Select all
    await page.type(selector, value);
  },

  /**
   * Toggle a checkbox
   */
  async setCheckbox(page: Page, selector: string, checked: boolean): Promise<void> {
    const checkbox = await page.waitForSelector(selector);
    const isChecked = await checkbox?.evaluate((el) => (el as HTMLInputElement).checked);

    if (isChecked !== checked) {
      await checkbox?.click();
    }
  },

  /**
   * Select from a picklist/dropdown
   */
  async selectOption(page: Page, selector: string, value: string): Promise<void> {
    await page.waitForSelector(selector);
    await page.select(selector, value);
  },

  /**
   * Wait for and dismiss toast message
   */
  async waitForToast(page: Page, expectedMessage?: string): Promise<string> {
    const toast = await page.waitForSelector('.toastMessage, .slds-notify__content', {
      timeout: 30000,
    });
    const message = await toast?.evaluate((el) => el.textContent || '');

    if (expectedMessage && !message.includes(expectedMessage)) {
      throw new Error(`Expected toast "${expectedMessage}" but got "${message}"`);
    }

    return message;
  },

  /**
   * Handle confirmation dialog
   */
  async confirmDialog(page: Page, confirm: boolean = true): Promise<void> {
    const buttonLabel = confirm ? 'Confirm' : 'Cancel';
    const dialog = await page.waitForSelector('.slds-modal__container, .modal-container');

    if (dialog) {
      await page.click(`button:has-text("${buttonLabel}"), input[value="${buttonLabel}"]`);
    }
  },
};

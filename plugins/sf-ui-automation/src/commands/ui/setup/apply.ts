import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { readFileSync, existsSync } from 'fs';
import { BrowserManager } from '../../../lib/browser.js';
import { SetupAutomations } from '../../../lib/setup-automations.js';

Messages.importMessagesDirectory(__dirname);

interface SetupConfig {
  sessionSettings?: {
    sessionTimeout?: number;
    forceLogoutOnSessionTimeout?: boolean;
    lockSessionsToIp?: boolean;
    requireHttpOnly?: boolean;
    requireSecureConnections?: boolean;
  };
  sharingSettings?: Array<{
    objectName: string;
    internalAccess: 'Private' | 'Public Read Only' | 'Public Read/Write' | 'Controlled by Parent';
    externalAccess?: 'Private' | 'Public Read Only' | 'Public Read/Write';
    grantAccessUsingHierarchies?: boolean;
  }>;
  einsteinActivityCapture?: {
    enabled: boolean;
    captureEmails?: boolean;
    captureEvents?: boolean;
  };
  omniChannel?: {
    enabled: boolean;
    enableSkillBasedRouting?: boolean;
    enableExternalRouting?: boolean;
  };
  flows?: Array<{
    flowApiName: string;
    activate: boolean;
  }>;
  orgWideEmails?: Array<{
    displayName: string;
    emailAddress: string;
    allowAllProfiles: boolean;
  }>;
}

export type ApplySetupResult = {
  success: boolean;
  message: string;
  applied: string[];
  failed: string[];
};

export default class SetupApply extends SfCommand<ApplySetupResult> {
  public static readonly summary = 'Apply multiple configuration settings from a JSON file via UI automation';

  public static readonly description = `Bulk configure Salesforce settings that are not available through Metadata API.
Reads configuration from a JSON file and applies all settings in sequence.

The configuration file supports:
- Session settings
- Sharing/OWD settings
- Einstein Activity Capture
- Omni-Channel settings
- Flow activation/deactivation
- Org-Wide Email addresses`;

  public static readonly examples = [
    `$ sf ui setup apply --target-org myOrg --config-file ./setup-config.json`,
    `$ sf ui setup apply -o myOrg -f ./config/prod-settings.json --no-headless`,
  ];

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: 'Target Salesforce org',
      char: 'o',
      required: true,
    }),
    'config-file': Flags.file({
      summary: 'Path to JSON configuration file',
      char: 'f',
      required: true,
      exists: true,
    }),
    'no-headless': Flags.boolean({
      summary: 'Run browser in visible mode (for debugging)',
      default: false,
    }),
    'continue-on-error': Flags.boolean({
      summary: 'Continue with remaining settings if one fails',
      default: false,
    }),
  };

  public async run(): Promise<ApplySetupResult> {
    const { flags } = await this.parse(SetupApply);
    const org = flags['target-org'];

    // Load configuration file
    const configContent = readFileSync(flags['config-file'], 'utf-8');
    const config: SetupConfig = JSON.parse(configContent);

    this.log(`Loaded configuration from: ${flags['config-file']}`);

    this.spinner.start('Connecting to Salesforce...');

    const browserManager = new BrowserManager({
      headless: !flags['no-headless'],
    });

    const applied: string[] = [];
    const failed: string[] = [];

    try {
      const session = await browserManager.connect(org);
      this.spinner.stop();

      this.log(`Connected to: ${session.instanceUrl}`);

      const automations = new SetupAutomations(browserManager);

      // Apply session settings
      if (config.sessionSettings) {
        try {
          this.spinner.start('Applying session settings...');
          await automations.configureSessionSettings(session.page, config.sessionSettings);
          this.spinner.stop();
          applied.push('Session Settings');
          this.logSuccess('Session settings applied');
        } catch (error) {
          this.spinner.stop();
          const msg = `Session Settings: ${error instanceof Error ? error.message : String(error)}`;
          failed.push(msg);
          this.warn(msg);
          if (!flags['continue-on-error']) throw error;
        }
      }

      // Apply sharing settings
      if (config.sharingSettings) {
        for (const sharing of config.sharingSettings) {
          try {
            this.spinner.start(`Applying sharing settings for ${sharing.objectName}...`);
            await automations.configureOrgWideDefaults(session.page, sharing);
            this.spinner.stop();
            applied.push(`Sharing: ${sharing.objectName}`);
            this.logSuccess(`Sharing settings applied for ${sharing.objectName}`);
          } catch (error) {
            this.spinner.stop();
            const msg = `Sharing ${sharing.objectName}: ${error instanceof Error ? error.message : String(error)}`;
            failed.push(msg);
            this.warn(msg);
            if (!flags['continue-on-error']) throw error;
          }
        }
      }

      // Apply Einstein Activity Capture
      if (config.einsteinActivityCapture) {
        try {
          this.spinner.start('Applying Einstein Activity Capture settings...');
          await automations.configureEinsteinActivityCapture(session.page, config.einsteinActivityCapture);
          this.spinner.stop();
          applied.push('Einstein Activity Capture');
          this.logSuccess('Einstein Activity Capture settings applied');
        } catch (error) {
          this.spinner.stop();
          const msg = `Einstein Activity Capture: ${error instanceof Error ? error.message : String(error)}`;
          failed.push(msg);
          this.warn(msg);
          if (!flags['continue-on-error']) throw error;
        }
      }

      // Apply Omni-Channel settings
      if (config.omniChannel) {
        try {
          this.spinner.start('Applying Omni-Channel settings...');
          await automations.configureOmniChannel(session.page, config.omniChannel);
          this.spinner.stop();
          applied.push('Omni-Channel');
          this.logSuccess('Omni-Channel settings applied');
        } catch (error) {
          this.spinner.stop();
          const msg = `Omni-Channel: ${error instanceof Error ? error.message : String(error)}`;
          failed.push(msg);
          this.warn(msg);
          if (!flags['continue-on-error']) throw error;
        }
      }

      // Activate/deactivate flows
      if (config.flows) {
        for (const flow of config.flows) {
          try {
            this.spinner.start(`${flow.activate ? 'Activating' : 'Deactivating'} flow ${flow.flowApiName}...`);
            await automations.activateFlow(session.page, flow);
            this.spinner.stop();
            applied.push(`Flow: ${flow.flowApiName}`);
            this.logSuccess(`Flow ${flow.flowApiName} ${flow.activate ? 'activated' : 'deactivated'}`);
          } catch (error) {
            this.spinner.stop();
            const msg = `Flow ${flow.flowApiName}: ${error instanceof Error ? error.message : String(error)}`;
            failed.push(msg);
            this.warn(msg);
            if (!flags['continue-on-error']) throw error;
          }
        }
      }

      // Configure org-wide emails
      if (config.orgWideEmails) {
        for (const email of config.orgWideEmails) {
          try {
            this.spinner.start(`Configuring org-wide email: ${email.displayName}...`);
            await automations.configureOrgWideEmailAddress(session.page, email);
            this.spinner.stop();
            applied.push(`Org-Wide Email: ${email.displayName}`);
            this.logSuccess(`Org-wide email configured: ${email.displayName}`);
          } catch (error) {
            this.spinner.stop();
            const msg = `Org-Wide Email ${email.displayName}: ${error instanceof Error ? error.message : String(error)}`;
            failed.push(msg);
            this.warn(msg);
            if (!flags['continue-on-error']) throw error;
          }
        }
      }

      // Summary
      this.log('\n' + '='.repeat(60));
      this.log('CONFIGURATION SUMMARY');
      this.log('='.repeat(60));
      this.log(`Applied: ${applied.length}`);
      applied.forEach((item) => this.log(`  ✓ ${item}`));

      if (failed.length > 0) {
        this.log(`Failed: ${failed.length}`);
        failed.forEach((item) => this.log(`  ✗ ${item}`));
      }
      this.log('='.repeat(60));

      return {
        success: failed.length === 0,
        message: `Applied ${applied.length} settings, ${failed.length} failed`,
        applied,
        failed,
      };
    } catch (error) {
      this.spinner.stop();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error(`Configuration failed: ${errorMessage}`);
    } finally {
      await browserManager.disconnect();
    }
  }
}

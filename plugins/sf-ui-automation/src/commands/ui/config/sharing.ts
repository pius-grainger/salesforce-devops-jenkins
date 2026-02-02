import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { BrowserManager } from '../../../lib/browser.js';
import { SetupAutomations } from '../../../lib/setup-automations.js';

Messages.importMessagesDirectory(__dirname);

export type SharingConfigResult = {
  success: boolean;
  message: string;
  object: string;
  settings: Record<string, unknown>;
};

export default class ConfigSharing extends SfCommand<SharingConfigResult> {
  public static readonly summary = 'Configure Organization-Wide Defaults (OWD) via UI automation';

  public static readonly description = `Configure sharing settings for Salesforce objects that require UI interaction.
This is useful for objects where sharing settings cannot be easily set via Metadata API.`;

  public static readonly examples = [
    `$ sf ui config sharing --target-org myOrg --object Account --internal "Public Read Only"`,
    `$ sf ui config sharing -o myOrg --object Case --internal Private --external Private`,
    `$ sf ui config sharing -o myOrg --object CustomObject__c --internal "Public Read/Write" --no-hierarchy`,
  ];

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: 'Target Salesforce org',
      char: 'o',
      required: true,
    }),
    object: Flags.string({
      summary: 'API name of the object to configure',
      required: true,
    }),
    internal: Flags.string({
      summary: 'Internal access level',
      options: ['Private', 'Public Read Only', 'Public Read/Write', 'Controlled by Parent'],
      required: true,
    }),
    external: Flags.string({
      summary: 'External access level (for communities)',
      options: ['Private', 'Public Read Only', 'Public Read/Write'],
    }),
    'no-hierarchy': Flags.boolean({
      summary: 'Disable "Grant Access Using Hierarchies"',
      default: false,
    }),
    'no-headless': Flags.boolean({
      summary: 'Run browser in visible mode (for debugging)',
      default: false,
    }),
  };

  public async run(): Promise<SharingConfigResult> {
    const { flags } = await this.parse(ConfigSharing);
    const org = flags['target-org'];

    this.spinner.start('Connecting to Salesforce...');

    const browserManager = new BrowserManager({
      headless: !flags['no-headless'],
    });

    try {
      const session = await browserManager.connect(org);
      this.spinner.stop();

      this.log(`Connected to: ${session.instanceUrl}`);
      this.log(`Configuring sharing for: ${flags.object}`);

      const automations = new SetupAutomations(browserManager);

      this.spinner.start('Configuring Organization-Wide Defaults...');

      await automations.configureOrgWideDefaults(session.page, {
        objectName: flags.object,
        internalAccess: flags.internal as 'Private' | 'Public Read Only' | 'Public Read/Write' | 'Controlled by Parent',
        externalAccess: flags.external as 'Private' | 'Public Read Only' | 'Public Read/Write' | undefined,
        grantAccessUsingHierarchies: !flags['no-hierarchy'],
      });

      this.spinner.stop();

      const settings = {
        internalAccess: flags.internal,
        externalAccess: flags.external,
        grantAccessUsingHierarchies: !flags['no-hierarchy'],
      };

      this.logSuccess(`Sharing settings configured for ${flags.object}`);

      return {
        success: true,
        message: `Sharing settings configured for ${flags.object}`,
        object: flags.object,
        settings,
      };
    } catch (error) {
      this.spinner.stop();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error(`Failed to configure sharing settings: ${errorMessage}`);
    } finally {
      await browserManager.disconnect();
    }
  }
}

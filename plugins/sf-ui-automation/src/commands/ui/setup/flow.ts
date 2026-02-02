import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { BrowserManager } from '../../../lib/browser.js';
import { SetupAutomations } from '../../../lib/setup-automations.js';

Messages.importMessagesDirectory(__dirname);

export type FlowSetupResult = {
  success: boolean;
  message: string;
  flowName: string;
  action: 'activated' | 'deactivated';
};

export default class SetupFlow extends SfCommand<FlowSetupResult> {
  public static readonly summary = 'Activate or deactivate a Flow via UI automation';

  public static readonly description = `Manage Flow activation status for flows that need to be activated through the UI.
This is useful in deployment pipelines where flows need to be activated after metadata deployment.`;

  public static readonly examples = [
    `$ sf ui setup flow --target-org myOrg --flow-name My_Flow --activate`,
    `$ sf ui setup flow -o myOrg --flow-name Account_Trigger_Flow --deactivate`,
    `$ sf ui setup flow -o myOrg --flow-name Case_Assignment --activate --no-headless`,
  ];

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: 'Target Salesforce org',
      char: 'o',
      required: true,
    }),
    'flow-name': Flags.string({
      summary: 'API name of the Flow',
      required: true,
    }),
    activate: Flags.boolean({
      summary: 'Activate the Flow',
      exclusive: ['deactivate'],
    }),
    deactivate: Flags.boolean({
      summary: 'Deactivate the Flow',
      exclusive: ['activate'],
    }),
    'no-headless': Flags.boolean({
      summary: 'Run browser in visible mode (for debugging)',
      default: false,
    }),
  };

  public async run(): Promise<FlowSetupResult> {
    const { flags } = await this.parse(SetupFlow);
    const org = flags['target-org'];

    if (!flags.activate && !flags.deactivate) {
      this.error('You must specify either --activate or --deactivate');
    }

    const shouldActivate = flags.activate === true;

    this.spinner.start('Connecting to Salesforce...');

    const browserManager = new BrowserManager({
      headless: !flags['no-headless'],
    });

    try {
      const session = await browserManager.connect(org);
      this.spinner.stop();

      this.log(`Connected to: ${session.instanceUrl}`);
      this.log(`${shouldActivate ? 'Activating' : 'Deactivating'} Flow: ${flags['flow-name']}`);

      const automations = new SetupAutomations(browserManager);

      this.spinner.start(`${shouldActivate ? 'Activating' : 'Deactivating'} Flow...`);

      await automations.activateFlow(session.page, {
        flowApiName: flags['flow-name'],
        activate: shouldActivate,
      });

      this.spinner.stop();

      this.logSuccess(`Flow ${flags['flow-name']} ${shouldActivate ? 'activated' : 'deactivated'} successfully`);

      return {
        success: true,
        message: `Flow ${shouldActivate ? 'activated' : 'deactivated'} successfully`,
        flowName: flags['flow-name'],
        action: shouldActivate ? 'activated' : 'deactivated',
      };
    } catch (error) {
      this.spinner.stop();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error(`Failed to ${shouldActivate ? 'activate' : 'deactivate'} Flow: ${errorMessage}`);
    } finally {
      await browserManager.disconnect();
    }
  }
}

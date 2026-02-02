import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { BrowserManager } from '../../../lib/browser.js';
import { SetupAutomations } from '../../../lib/setup-automations.js';

Messages.importMessagesDirectory(__dirname);

export type SessionConfigResult = {
  success: boolean;
  message: string;
  settings: Record<string, unknown>;
};

export default class ConfigSession extends SfCommand<SessionConfigResult> {
  public static readonly summary = 'Configure Salesforce session settings via UI automation';

  public static readonly description = `Configure session security settings that are not available through the Metadata API.
This includes session timeout, IP locking, and various security options.`;

  public static readonly examples = [
    `$ sf ui config session --target-org myOrg --timeout 120 --lock-ip`,
    `$ sf ui config session -o myOrg --timeout 60 --force-logout --http-only`,
    `$ sf ui config session -o myOrg --secure-connections --no-headless`,
  ];

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: 'Target Salesforce org',
      char: 'o',
      required: true,
    }),
    timeout: Flags.integer({
      summary: 'Session timeout in minutes',
      char: 't',
    }),
    'force-logout': Flags.boolean({
      summary: 'Force logout on session timeout',
    }),
    'lock-ip': Flags.boolean({
      summary: 'Lock sessions to the IP address from which they originated',
    }),
    'http-only': Flags.boolean({
      summary: 'Require HttpOnly attribute on session cookies',
    }),
    'secure-connections': Flags.boolean({
      summary: 'Require secure connections (HTTPS)',
    }),
    'no-headless': Flags.boolean({
      summary: 'Run browser in visible mode (for debugging)',
      default: false,
    }),
  };

  public async run(): Promise<SessionConfigResult> {
    const { flags } = await this.parse(ConfigSession);
    const org = flags['target-org'];

    this.spinner.start('Connecting to Salesforce...');

    const browserManager = new BrowserManager({
      headless: !flags['no-headless'],
    });

    try {
      const session = await browserManager.connect(org);
      this.spinner.stop();

      this.log(`Connected to: ${session.instanceUrl}`);

      const automations = new SetupAutomations(browserManager);

      this.spinner.start('Configuring session settings...');

      await automations.configureSessionSettings(session.page, {
        sessionTimeout: flags.timeout,
        forceLogoutOnSessionTimeout: flags['force-logout'],
        lockSessionsToIp: flags['lock-ip'],
        requireHttpOnly: flags['http-only'],
        requireSecureConnections: flags['secure-connections'],
      });

      this.spinner.stop();

      const settings = {
        sessionTimeout: flags.timeout,
        forceLogout: flags['force-logout'],
        lockIp: flags['lock-ip'],
        httpOnly: flags['http-only'],
        secureConnections: flags['secure-connections'],
      };

      this.logSuccess('Session settings configured successfully');

      return {
        success: true,
        message: 'Session settings configured successfully',
        settings,
      };
    } catch (error) {
      this.spinner.stop();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error(`Failed to configure session settings: ${errorMessage}`);
    } finally {
      await browserManager.disconnect();
    }
  }
}

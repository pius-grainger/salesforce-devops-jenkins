# UI Automation Plugin Guide

This document describes the custom Salesforce CLI plugin for UI-based configuration automation.

## Overview

The `@fcdo/sf-ui-automation` plugin uses Puppeteer to automate Salesforce configuration tasks that are not available through the Metadata API or Tooling API.

## Installation

```bash
# Build the plugin
npm run build:plugin

# Link to Salesforce CLI
npm run ui:install-plugin

# Verify installation
sf plugins
```

## Why UI Automation?

Some Salesforce configurations can only be done through the Setup UI:

| Configuration | API Available? | UI Automation? |
|---------------|----------------|----------------|
| Metadata deployment | ✅ Yes | Not needed |
| Apex classes | ✅ Yes | Not needed |
| Session timeout | ❌ No | ✅ Required |
| OWD sharing settings | ⚠️ Partial | ✅ Recommended |
| Einstein Activity Capture | ❌ No | ✅ Required |
| Flow activation | ⚠️ Partial | ✅ Recommended |
| Identity Provider | ❌ No | ✅ Required |

## Available Commands

### `sf ui config session`

Configure session security settings.

```bash
sf ui config session \
  --target-org QAOrg \
  --timeout 120 \
  --lock-ip \
  --http-only \
  --secure-connections
```

**Flags:**

| Flag | Description |
|------|-------------|
| `-o, --target-org` | Target Salesforce org (required) |
| `-t, --timeout` | Session timeout in minutes |
| `--force-logout` | Force logout on session timeout |
| `--lock-ip` | Lock sessions to originating IP |
| `--http-only` | Require HttpOnly cookie attribute |
| `--secure-connections` | Require HTTPS |
| `--no-headless` | Run browser in visible mode |

### `sf ui config sharing`

Configure Organization-Wide Defaults (OWD).

```bash
sf ui config sharing \
  --target-org QAOrg \
  --object Case \
  --internal Private \
  --external Private \
  --no-hierarchy
```

**Flags:**

| Flag | Description |
|------|-------------|
| `-o, --target-org` | Target Salesforce org (required) |
| `--object` | Object API name (required) |
| `--internal` | Internal access level (required) |
| `--external` | External access level |
| `--no-hierarchy` | Disable hierarchy access |

**Access Levels:**
- `Private`
- `Public Read Only`
- `Public Read/Write`
- `Controlled by Parent`

### `sf ui setup flow`

Activate or deactivate a Flow.

```bash
# Activate a flow
sf ui setup flow \
  --target-org QAOrg \
  --flow-name Account_Assignment_Flow \
  --activate

# Deactivate a flow
sf ui setup flow \
  --target-org QAOrg \
  --flow-name Debug_Test_Flow \
  --deactivate
```

**Flags:**

| Flag | Description |
|------|-------------|
| `-o, --target-org` | Target Salesforce org (required) |
| `--flow-name` | Flow API name (required) |
| `--activate` | Activate the flow |
| `--deactivate` | Deactivate the flow |

### `sf ui setup apply`

Apply multiple configurations from a JSON file.

```bash
sf ui setup apply \
  --target-org QAOrg \
  --config-file config/ui-automation/qa-setup.json \
  --continue-on-error
```

**Flags:**

| Flag | Description |
|------|-------------|
| `-o, --target-org` | Target Salesforce org (required) |
| `-f, --config-file` | Path to JSON config file (required) |
| `--continue-on-error` | Continue if a setting fails |
| `--no-headless` | Run browser in visible mode |

## Configuration File Format

Create a JSON configuration file for bulk operations:

```json
{
  "sessionSettings": {
    "sessionTimeout": 120,
    "forceLogoutOnSessionTimeout": true,
    "lockSessionsToIp": false,
    "requireHttpOnly": true,
    "requireSecureConnections": true
  },

  "sharingSettings": [
    {
      "objectName": "Account",
      "internalAccess": "Public Read Only",
      "externalAccess": "Private",
      "grantAccessUsingHierarchies": true
    },
    {
      "objectName": "Case",
      "internalAccess": "Private",
      "grantAccessUsingHierarchies": true
    }
  ],

  "einsteinActivityCapture": {
    "enabled": true,
    "captureEmails": true,
    "captureEvents": true
  },

  "omniChannel": {
    "enabled": true,
    "enableSkillBasedRouting": true,
    "enableExternalRouting": false
  },

  "flows": [
    {
      "flowApiName": "Account_Assignment_Flow",
      "activate": true
    },
    {
      "flowApiName": "Debug_Flow",
      "activate": false
    }
  ],

  "orgWideEmails": [
    {
      "displayName": "Support Team",
      "emailAddress": "support@example.com",
      "allowAllProfiles": true
    }
  ]
}
```

## How It Works

### Authentication Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  SF CLI     │───▶│  Access     │───▶│ Puppeteer   │
│  Session    │    │  Token      │    │  Browser    │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
                                      ┌─────────────┐
                                      │ frontdoor   │
                                      │   .jsp      │
                                      └─────────────┘
                                            │
                                            ▼
                                      ┌─────────────┐
                                      │  Salesforce │
                                      │   Setup     │
                                      └─────────────┘
```

The plugin:
1. Gets the access token from the authenticated SF CLI session
2. Launches a headless Chrome browser via Puppeteer
3. Authenticates using `frontdoor.jsp` (session injection)
4. Navigates to Setup pages and makes changes
5. Closes the browser

### Browser Management

```typescript
// Browser is launched with these options
const browser = await puppeteer.launch({
  headless: 'new',      // Headless mode
  slowMo: 50,           // Slow down for stability
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage'
  ]
});
```

## Debugging

### Run in Visible Mode

Use `--no-headless` to watch the automation:

```bash
sf ui config session -o QAOrg --timeout 60 --no-headless
```

### Take Screenshots

The plugin captures screenshots on errors. Check the current directory for `error-*.png` files.

### Verbose Logging

Enable debug output:

```bash
DEBUG=* sf ui setup apply -o QAOrg -f config.json
```

## Error Handling

### Common Errors

**"Failed to authenticate to Salesforce"**
- Verify the target org is authenticated: `sf org display -o QAOrg`
- Re-authenticate if needed: `sf org login web -a QAOrg`

**"Element not found"**
- Salesforce UI may have changed
- Run in visible mode to investigate
- Check for org-specific customizations

**"Timeout waiting for..."**
- Increase timeout in browser options
- Check network connectivity
- Verify Salesforce isn't in maintenance

### Retry Logic

The `--continue-on-error` flag allows the pipeline to continue even if some configurations fail:

```bash
sf ui setup apply -o QAOrg -f config.json --continue-on-error
```

Failed configurations are logged and reported in the summary.

## Jenkins Integration

The pipeline includes a post-deployment stage for UI configuration:

```groovy
stage('Post-Deploy UI Configuration') {
    steps {
        sh '''
            npm run ui:install-plugin
            sf ui setup apply \
                --target-org QAOrg \
                --config-file config/ui-automation/qa-setup.json \
                --continue-on-error
        '''
    }
}
```

## Best Practices

1. **Environment-specific configs**: Create separate config files for each environment
2. **Idempotent operations**: Design configs to be safely re-applied
3. **Validation**: Test configs in a scratch org first
4. **Monitoring**: Review UI automation logs after deployment
5. **Fallback**: Have manual runbooks for critical configurations

## Extending the Plugin

### Adding New Automations

1. Add method to `src/lib/setup-automations.ts`
2. Create command in `src/commands/ui/`
3. Update config file schema
4. Add to `apply.ts` for bulk execution

### Example: New Automation

```typescript
// In setup-automations.ts
async configureNewFeature(page: Page, options: { enabled: boolean }): Promise<void> {
  await this.browserManager.navigateToSetup(page, 'NewFeatureSettings');
  const setupPage = await this.browserManager.getSetupIframe(page);

  await SalesforceUI.setCheckbox(
    setupPage,
    'input[id*="enable"]',
    options.enabled
  );

  await SalesforceUI.clickButton(setupPage, 'Save');
  await SalesforceUI.waitForToast(setupPage);
}
```

## Limitations

- UI changes in Salesforce releases may break automations
- Some operations require multiple page loads (slower than API)
- Cannot run multiple instances simultaneously per org
- Requires Chrome/Chromium on Jenkins agents

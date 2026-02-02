#!/usr/bin/env node

import { execSync, exec } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import type { ScratchOrgResult, ScratchOrgConfig } from './types.js';

const PROJECT_ROOT = join(__dirname, '..', '..');
const SCRATCH_DEF_PATH = join(PROJECT_ROOT, 'config', 'project-scratch-def.json');

function runSfdxCommand(command: string): string {
  console.log(`Executing: sf ${command}`);
  try {
    return execSync(`sf ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: PROJECT_ROOT,
    });
  } catch (error) {
    const execError = error as { stderr?: string; message: string };
    throw new Error(execError.stderr || execError.message);
  }
}

function parseJsonOutput<T>(output: string): T {
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new Error(`Failed to parse SFDX output: ${output}`);
  }
}

export async function createScratchOrg(options: {
  alias?: string;
  durationDays?: number;
  devHub?: string;
  noNamespace?: boolean;
}): Promise<ScratchOrgResult> {
  const alias = options.alias || `scratch-${Date.now()}`;
  const duration = options.durationDays || 7;

  console.log(`Creating scratch org with alias: ${alias}`);

  if (!existsSync(SCRATCH_DEF_PATH)) {
    return {
      success: false,
      error: `Scratch org definition not found at: ${SCRATCH_DEF_PATH}`,
    };
  }

  try {
    let command = `org create scratch -f ${SCRATCH_DEF_PATH} -a ${alias} -d ${duration} --json`;

    if (options.devHub) {
      command += ` -v ${options.devHub}`;
    }

    if (options.noNamespace) {
      command += ' --no-namespace';
    }

    const output = runSfdxCommand(command);
    const result = parseJsonOutput<{
      status: number;
      result: {
        orgId: string;
        username: string;
        instanceUrl: string;
        loginUrl: string;
        expirationDate: string;
      };
    }>(output);

    if (result.status === 0) {
      console.log(`Scratch org created successfully!`);
      console.log(`  Org ID: ${result.result.orgId}`);
      console.log(`  Username: ${result.result.username}`);
      console.log(`  Instance URL: ${result.result.instanceUrl}`);
      console.log(`  Expires: ${result.result.expirationDate}`);

      // Push source to scratch org
      console.log('\nPushing source to scratch org...');
      await pushSource(alias);

      return {
        success: true,
        orgId: result.result.orgId,
        username: result.result.username,
        instanceUrl: result.result.instanceUrl,
        loginUrl: result.result.loginUrl,
        expirationDate: result.result.expirationDate,
      };
    }

    return {
      success: false,
      error: 'Failed to create scratch org',
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function pushSource(targetOrg: string): Promise<void> {
  console.log(`Pushing source to org: ${targetOrg}`);
  const output = runSfdxCommand(`project deploy start -o ${targetOrg} --json`);
  const result = parseJsonOutput<{ status: number; result: { deployedSource: unknown[] } }>(output);

  if (result.status === 0) {
    console.log(`Successfully pushed ${result.result.deployedSource.length} components`);
  } else {
    throw new Error('Failed to push source');
  }
}

export async function deleteScratchOrg(options: {
  targetOrg: string;
  devHub?: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log(`Deleting scratch org: ${options.targetOrg}`);

  try {
    let command = `org delete scratch -o ${options.targetOrg} -p --json`;

    if (options.devHub) {
      command += ` -v ${options.devHub}`;
    }

    const output = runSfdxCommand(command);
    const result = parseJsonOutput<{ status: number }>(output);

    if (result.status === 0) {
      console.log('Scratch org deleted successfully');
      return { success: true };
    }

    return { success: false, error: 'Failed to delete scratch org' };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

export function listScratchOrgs(devHub?: string): void {
  let command = 'org list --json';
  if (devHub) {
    command += ` -v ${devHub}`;
  }

  const output = runSfdxCommand(command);
  const result = parseJsonOutput<{
    result: {
      scratchOrgs: Array<{
        alias: string;
        username: string;
        orgId: string;
        expirationDate: string;
        status: string;
      }>;
    };
  }>(output);

  console.log('\nScratch Orgs:');
  console.log('='.repeat(80));

  if (result.result.scratchOrgs.length === 0) {
    console.log('No scratch orgs found');
    return;
  }

  for (const org of result.result.scratchOrgs) {
    console.log(`  Alias: ${org.alias || 'N/A'}`);
    console.log(`  Username: ${org.username}`);
    console.log(`  Org ID: ${org.orgId}`);
    console.log(`  Expires: ${org.expirationDate}`);
    console.log(`  Status: ${org.status}`);
    console.log('-'.repeat(40));
  }
}

export function openScratchOrg(targetOrg: string): void {
  console.log(`Opening scratch org: ${targetOrg}`);
  execSync(`sf org open -o ${targetOrg}`, { stdio: 'inherit', cwd: PROJECT_ROOT });
}

// CLI interface
const program = new Command();

program
  .name('scratch-org')
  .description('Salesforce scratch org management utilities')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new scratch org')
  .option('-a, --alias <alias>', 'Alias for the scratch org')
  .option('-d, --duration <days>', 'Duration in days (1-30)', '7')
  .option('-v, --dev-hub <username>', 'Dev Hub username or alias')
  .option('--no-namespace', 'Create without namespace')
  .action(async (options) => {
    const result = await createScratchOrg({
      alias: options.alias,
      durationDays: parseInt(options.duration, 10),
      devHub: options.devHub,
      noNamespace: options.noNamespace,
    });

    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  });

program
  .command('delete')
  .description('Delete a scratch org')
  .requiredOption('-o, --target-org <org>', 'Target scratch org username or alias')
  .option('-v, --dev-hub <username>', 'Dev Hub username or alias')
  .action(async (options) => {
    const result = await deleteScratchOrg({
      targetOrg: options.targetOrg,
      devHub: options.devHub,
    });

    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all scratch orgs')
  .option('-v, --dev-hub <username>', 'Dev Hub username or alias')
  .action((options) => {
    listScratchOrgs(options.devHub);
  });

program
  .command('open')
  .description('Open a scratch org in browser')
  .requiredOption('-o, --target-org <org>', 'Target scratch org username or alias')
  .action((options) => {
    openScratchOrg(options.targetOrg);
  });

program.parse();

#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import type { EnvironmentConfig, DeployResult, DeployError } from './types.js';

const PROJECT_ROOT = join(__dirname, '..', '..');
const ENVIRONMENTS_DIR = join(PROJECT_ROOT, 'config', 'environments');

function loadEnvironmentConfig(envName: string): EnvironmentConfig {
  const configPath = join(ENVIRONMENTS_DIR, `${envName}.json`);

  if (!existsSync(configPath)) {
    throw new Error(`Environment config not found: ${configPath}`);
  }

  const content = readFileSync(configPath, 'utf-8');
  return JSON.parse(content) as EnvironmentConfig;
}

function runSfdxCommand(command: string, cwd: string = PROJECT_ROOT): string {
  console.log(`Executing: sf ${command}`);
  try {
    return execSync(`sf ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large deployments
    });
  } catch (error) {
    const execError = error as { stderr?: string; stdout?: string; message: string };
    // Try to parse JSON error from stdout
    if (execError.stdout) {
      try {
        const parsed = JSON.parse(execError.stdout);
        if (parsed.message) {
          throw new Error(parsed.message);
        }
      } catch {
        // Not JSON, continue with original error
      }
    }
    throw new Error(execError.stderr || execError.message);
  }
}

function parseJsonOutput<T>(output: string): T {
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new Error(`Failed to parse SFDX output: ${output.slice(0, 500)}...`);
  }
}

export async function deployToOrg(options: {
  environment: string;
  checkOnly?: boolean;
  testLevel?: string;
  specificTests?: string[];
  ignoreWarnings?: boolean;
}): Promise<DeployResult> {
  const config = loadEnvironmentConfig(options.environment);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Deploying to: ${config.displayName} (${config.name})`);
  console.log(`Target org: ${config.username}`);
  console.log(`${'='.repeat(60)}\n`);

  const testLevel = options.testLevel || config.apexTestLevel;

  let command = `project deploy start -o ${config.username} --json`;

  if (options.checkOnly) {
    command += ' --dry-run';
    console.log('Running validation only (check-only deployment)');
  }

  // Add test level
  command += ` -l ${testLevel}`;

  if (testLevel === 'RunSpecifiedTests' && options.specificTests?.length) {
    command += ` -t ${options.specificTests.join(',')}`;
  }

  if (options.ignoreWarnings) {
    command += ' --ignore-warnings';
  }

  // Add wait time for deployment to complete
  command += ' -w 60';

  try {
    const output = runSfdxCommand(command);
    const result = parseJsonOutput<{
      status: number;
      result: {
        id: string;
        status: string;
        success: boolean;
        numberComponentsDeployed: number;
        numberComponentErrors: number;
        numberTestsCompleted: number;
        numberTestErrors: number;
        details?: {
          componentFailures?: Array<{
            componentType: string;
            fullName: string;
            problem: string;
            lineNumber?: number;
            columnNumber?: number;
          }>;
          runTestResult?: {
            codeCoverage?: Array<{
              name: string;
              numLocations: number;
              numLocationsNotCovered: number;
            }>;
          };
        };
      };
    }>(output);

    const deployResult: DeployResult = {
      success: result.result.success,
      deployId: result.result.id,
      componentSuccesses: result.result.numberComponentsDeployed,
      componentFailures: result.result.numberComponentErrors,
      testsPassed: result.result.numberTestsCompleted - (result.result.numberTestErrors || 0),
      testsFailed: result.result.numberTestErrors || 0,
      codeCoverage: calculateCoverage(result.result.details?.runTestResult?.codeCoverage),
      errors: extractErrors(result.result.details?.componentFailures),
    };

    printDeploymentSummary(deployResult, config);

    // Check coverage threshold
    if (config.runApexTests && deployResult.codeCoverage < config.minCoveragePercent) {
      console.error(
        `\nCode coverage ${deployResult.codeCoverage}% is below minimum ${config.minCoveragePercent}%`
      );
      deployResult.success = false;
    }

    return deployResult;
  } catch (error) {
    const err = error as Error;
    console.error(`Deployment failed: ${err.message}`);
    return {
      success: false,
      deployId: '',
      componentSuccesses: 0,
      componentFailures: 0,
      testsPassed: 0,
      testsFailed: 0,
      codeCoverage: 0,
      errors: [
        {
          componentType: 'Deployment',
          fullName: 'N/A',
          problem: err.message,
        },
      ],
    };
  }
}

function calculateCoverage(
  coverageData?: Array<{ numLocations: number; numLocationsNotCovered: number }>
): number {
  if (!coverageData || coverageData.length === 0) {
    return 0;
  }

  let totalLines = 0;
  let coveredLines = 0;

  for (const item of coverageData) {
    totalLines += item.numLocations;
    coveredLines += item.numLocations - item.numLocationsNotCovered;
  }

  if (totalLines === 0) {
    return 0;
  }

  return Math.round((coveredLines / totalLines) * 100);
}

function extractErrors(
  failures?: Array<{
    componentType: string;
    fullName: string;
    problem: string;
    lineNumber?: number;
    columnNumber?: number;
  }>
): DeployError[] {
  if (!failures) {
    return [];
  }

  return failures.map((f) => ({
    componentType: f.componentType,
    fullName: f.fullName,
    problem: f.problem,
    line: f.lineNumber,
    column: f.columnNumber,
  }));
}

function printDeploymentSummary(result: DeployResult, config: EnvironmentConfig): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log('DEPLOYMENT SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Deploy ID: ${result.deployId}`);
  console.log(`Components Deployed: ${result.componentSuccesses}`);
  console.log(`Component Failures: ${result.componentFailures}`);

  if (config.runApexTests) {
    console.log(`\nTest Results:`);
    console.log(`  Tests Passed: ${result.testsPassed}`);
    console.log(`  Tests Failed: ${result.testsFailed}`);
    console.log(`  Code Coverage: ${result.codeCoverage}%`);
    console.log(`  Minimum Required: ${config.minCoveragePercent}%`);
  }

  if (result.errors.length > 0) {
    console.log(`\nErrors:`);
    for (const error of result.errors) {
      console.log(`  [${error.componentType}] ${error.fullName}`);
      console.log(`    ${error.problem}`);
      if (error.line) {
        console.log(`    Line: ${error.line}, Column: ${error.column || 'N/A'}`);
      }
    }
  }

  console.log(`${'='.repeat(60)}\n`);
}

export async function quickDeploy(options: {
  deployId: string;
  targetOrg: string;
}): Promise<boolean> {
  console.log(`Running quick deploy for validated deployment: ${options.deployId}`);

  try {
    const command = `project deploy quick -i ${options.deployId} -o ${options.targetOrg} --json`;
    const output = runSfdxCommand(command);
    const result = parseJsonOutput<{ status: number; result: { success: boolean } }>(output);

    if (result.result.success) {
      console.log('Quick deploy completed successfully');
      return true;
    }

    console.error('Quick deploy failed');
    return false;
  } catch (error) {
    const err = error as Error;
    console.error(`Quick deploy failed: ${err.message}`);
    return false;
  }
}

export async function cancelDeploy(options: {
  deployId: string;
  targetOrg: string;
}): Promise<boolean> {
  console.log(`Cancelling deployment: ${options.deployId}`);

  try {
    const command = `project deploy cancel -i ${options.deployId} -o ${options.targetOrg} --json`;
    runSfdxCommand(command);
    console.log('Deployment cancelled');
    return true;
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to cancel deployment: ${err.message}`);
    return false;
  }
}

// CLI interface
const program = new Command();

program
  .name('deploy')
  .description('Salesforce deployment utilities')
  .version('1.0.0');

program
  .command('run')
  .description('Deploy to a Salesforce environment')
  .requiredOption('-e, --env <environment>', 'Target environment (dev, qa, prod)')
  .option('-c, --check-only', 'Validate deployment without deploying')
  .option('-l, --test-level <level>', 'Test level (NoTestRun, RunSpecifiedTests, RunLocalTests, RunAllTestsInOrg)')
  .option('-t, --tests <tests>', 'Comma-separated list of test classes (for RunSpecifiedTests)')
  .option('--ignore-warnings', 'Ignore deployment warnings')
  .action(async (options) => {
    const result = await deployToOrg({
      environment: options.env,
      checkOnly: options.checkOnly,
      testLevel: options.testLevel,
      specificTests: options.tests?.split(','),
      ignoreWarnings: options.ignoreWarnings,
    });

    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command('quick')
  .description('Quick deploy a previously validated deployment')
  .requiredOption('-i, --deploy-id <id>', 'Validated deployment ID')
  .requiredOption('-o, --target-org <org>', 'Target org username or alias')
  .action(async (options) => {
    const success = await quickDeploy({
      deployId: options.deployId,
      targetOrg: options.targetOrg,
    });

    if (!success) {
      process.exit(1);
    }
  });

program
  .command('cancel')
  .description('Cancel an in-progress deployment')
  .requiredOption('-i, --deploy-id <id>', 'Deployment ID to cancel')
  .requiredOption('-o, --target-org <org>', 'Target org username or alias')
  .action(async (options) => {
    const success = await cancelDeploy({
      deployId: options.deployId,
      targetOrg: options.targetOrg,
    });

    if (!success) {
      process.exit(1);
    }
  });

program.parse();

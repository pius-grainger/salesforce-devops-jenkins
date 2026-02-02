#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import type { ApexTestResult, TestMethodResult, ClassCoverage, EnvironmentConfig } from './types.js';

const PROJECT_ROOT = join(__dirname, '..', '..');
const TEST_RESULTS_DIR = join(PROJECT_ROOT, 'test-results');

function runSfdxCommand(command: string): string {
  console.log(`Executing: sf ${command}`);
  try {
    return execSync(`sf ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: PROJECT_ROOT,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    const execError = error as { stderr?: string; stdout?: string; message: string };
    // Return stdout even on error - test results are in stdout
    if (execError.stdout) {
      return execError.stdout;
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

function loadEnvironmentConfig(envName: string): EnvironmentConfig {
  const configPath = join(PROJECT_ROOT, 'config', 'environments', `${envName}.json`);
  if (!existsSync(configPath)) {
    throw new Error(`Environment config not found: ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, 'utf-8')) as EnvironmentConfig;
}

export async function runApexTests(options: {
  targetOrg: string;
  testLevel?: string;
  specificTests?: string[];
  outputDir?: string;
  minCoverage?: number;
}): Promise<ApexTestResult> {
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log('RUNNING APEX TESTS');
  console.log(`${'='.repeat(60)}`);
  console.log(`Target Org: ${options.targetOrg}`);
  console.log(`Test Level: ${options.testLevel || 'RunLocalTests'}`);

  let command = `apex run test -o ${options.targetOrg} --json -r human -c -w 30`;

  if (options.testLevel) {
    command += ` -l ${options.testLevel}`;
  } else {
    command += ' -l RunLocalTests';
  }

  if (options.specificTests?.length) {
    command += ` -t ${options.specificTests.join(',')}`;
  }

  // Store results in output directory
  const outputDir = options.outputDir || TEST_RESULTS_DIR;
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  command += ` -d ${outputDir}`;

  try {
    const output = runSfdxCommand(command);
    const rawResult = parseJsonOutput<{
      status: number;
      result: {
        summary: {
          outcome: string;
          testsRan: number;
          passing: number;
          failing: number;
          skipped: number;
          testRunId: string;
          testExecutionTimeInMs: number;
          orgWideCoverage: string;
        };
        tests: Array<{
          ApexClass: { Name: string };
          MethodName: string;
          Outcome: string;
          Message?: string;
          StackTrace?: string;
          RunTime: number;
        }>;
        coverage?: {
          coverage: Array<{
            name: string;
            coveredPercent: number;
            totalCovered: number;
            totalUncovered: number;
          }>;
        };
      };
    }>(output);

    const coverage = parseFloat(rawResult.result.summary.orgWideCoverage?.replace('%', '') || '0');

    const testResult: ApexTestResult = {
      success: rawResult.result.summary.outcome === 'Passed',
      totalTests: rawResult.result.summary.testsRan,
      passed: rawResult.result.summary.passing,
      failed: rawResult.result.summary.failing,
      skipped: rawResult.result.summary.skipped || 0,
      codeCoverage: coverage,
      coverageByClass: extractCoverageByClass(rawResult.result.coverage?.coverage),
      testResults: extractTestResults(rawResult.result.tests),
      duration: rawResult.result.summary.testExecutionTimeInMs || (Date.now() - startTime),
    };

    // Generate JUnit XML for Jenkins
    const junitXml = generateJUnitXml(testResult);
    writeFileSync(join(outputDir, 'junit-results.xml'), junitXml);
    console.log(`JUnit results written to: ${join(outputDir, 'junit-results.xml')}`);

    // Generate coverage report
    const coverageReport = generateCoverageReport(testResult);
    writeFileSync(join(outputDir, 'coverage-report.txt'), coverageReport);

    printTestSummary(testResult, options.minCoverage);

    // Check coverage threshold
    if (options.minCoverage && testResult.codeCoverage < options.minCoverage) {
      console.error(`\nCoverage ${testResult.codeCoverage}% is below minimum ${options.minCoverage}%`);
      testResult.success = false;
    }

    return testResult;
  } catch (error) {
    const err = error as Error;
    console.error(`Test execution failed: ${err.message}`);
    return {
      success: false,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      codeCoverage: 0,
      coverageByClass: [],
      testResults: [],
      duration: Date.now() - startTime,
    };
  }
}

function extractCoverageByClass(
  coverage?: Array<{
    name: string;
    coveredPercent: number;
    totalCovered: number;
    totalUncovered: number;
  }>
): ClassCoverage[] {
  if (!coverage) return [];

  return coverage.map((c) => ({
    name: c.name,
    coveredLines: c.totalCovered,
    uncoveredLines: c.totalUncovered,
    coveragePercent: c.coveredPercent,
  }));
}

function extractTestResults(
  tests?: Array<{
    ApexClass: { Name: string };
    MethodName: string;
    Outcome: string;
    Message?: string;
    StackTrace?: string;
    RunTime: number;
  }>
): TestMethodResult[] {
  if (!tests) return [];

  return tests.map((t) => ({
    className: t.ApexClass.Name,
    methodName: t.MethodName,
    outcome: t.Outcome as 'Pass' | 'Fail' | 'Skip',
    message: t.Message,
    stackTrace: t.StackTrace,
    duration: t.RunTime,
  }));
}

function printTestSummary(result: ApexTestResult, minCoverage?: number): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Status: ${result.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Total Tests: ${result.totalTests}`);
  console.log(`  Passed: ${result.passed}`);
  console.log(`  Failed: ${result.failed}`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`\nCode Coverage: ${result.codeCoverage}%`);
  if (minCoverage) {
    console.log(`Minimum Required: ${minCoverage}%`);
  }

  if (result.failed > 0) {
    console.log(`\nFailed Tests:`);
    for (const test of result.testResults.filter((t) => t.outcome === 'Fail')) {
      console.log(`  ${test.className}.${test.methodName}`);
      if (test.message) {
        console.log(`    Message: ${test.message}`);
      }
    }
  }

  if (result.coverageByClass.length > 0) {
    console.log(`\nCoverage by Class:`);
    const sortedCoverage = [...result.coverageByClass].sort(
      (a, b) => a.coveragePercent - b.coveragePercent
    );
    for (const c of sortedCoverage.slice(0, 10)) {
      const status = c.coveragePercent >= 75 ? '' : ' (LOW)';
      console.log(`  ${c.name}: ${c.coveragePercent}%${status}`);
    }
    if (sortedCoverage.length > 10) {
      console.log(`  ... and ${sortedCoverage.length - 10} more classes`);
    }
  }

  console.log(`${'='.repeat(60)}\n`);
}

function generateJUnitXml(result: ApexTestResult): string {
  const escapeXml = (str: string): string =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const testCases = result.testResults.map((test) => {
    let testCase = `    <testcase classname="${escapeXml(test.className)}" name="${escapeXml(test.methodName)}" time="${(test.duration / 1000).toFixed(3)}">`;

    if (test.outcome === 'Fail') {
      testCase += `\n      <failure message="${escapeXml(test.message || 'Test failed')}">${escapeXml(test.stackTrace || '')}</failure>`;
    } else if (test.outcome === 'Skip') {
      testCase += `\n      <skipped/>`;
    }

    testCase += `\n    </testcase>`;
    return testCase;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Apex Tests" tests="${result.totalTests}" failures="${result.failed}" skipped="${result.skipped}" time="${(result.duration / 1000).toFixed(3)}">
${testCases.join('\n')}
  </testsuite>
</testsuites>`;
}

function generateCoverageReport(result: ApexTestResult): string {
  let report = 'APEX CODE COVERAGE REPORT\n';
  report += '='.repeat(60) + '\n\n';
  report += `Overall Coverage: ${result.codeCoverage}%\n\n`;
  report += 'Coverage by Class:\n';
  report += '-'.repeat(60) + '\n';

  const sortedCoverage = [...result.coverageByClass].sort(
    (a, b) => a.coveragePercent - b.coveragePercent
  );

  for (const c of sortedCoverage) {
    const bar = '█'.repeat(Math.floor(c.coveragePercent / 5)) + '░'.repeat(20 - Math.floor(c.coveragePercent / 5));
    report += `${c.name.padEnd(40)} ${bar} ${c.coveragePercent.toString().padStart(3)}%\n`;
  }

  return report;
}

// CLI interface
const program = new Command();

program
  .name('test-runner')
  .description('Apex test execution utilities')
  .version('1.0.0');

program
  .command('run')
  .description('Run Apex tests')
  .requiredOption('-o, --target-org <org>', 'Target org username or alias')
  .option('-l, --test-level <level>', 'Test level (RunSpecifiedTests, RunLocalTests, RunAllTestsInOrg)')
  .option('-t, --tests <tests>', 'Comma-separated list of test classes')
  .option('-d, --output-dir <dir>', 'Output directory for test results')
  .option('-m, --min-coverage <percent>', 'Minimum coverage percentage', '75')
  .action(async (options) => {
    const result = await runApexTests({
      targetOrg: options.targetOrg,
      testLevel: options.testLevel,
      specificTests: options.tests?.split(','),
      outputDir: options.outputDir,
      minCoverage: parseInt(options.minCoverage, 10),
    });

    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command('env')
  .description('Run Apex tests for an environment')
  .requiredOption('-e, --env <environment>', 'Environment name (dev, qa, prod)')
  .option('-d, --output-dir <dir>', 'Output directory for test results')
  .action(async (options) => {
    const config = loadEnvironmentConfig(options.env);
    const result = await runApexTests({
      targetOrg: config.username,
      testLevel: config.apexTestLevel,
      outputDir: options.outputDir,
      minCoverage: config.minCoveragePercent,
    });

    if (!result.success) {
      process.exit(1);
    }
  });

program.parse();

#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('sf-devops')
  .description('Salesforce DevOps CLI')
  .version('1.0.0');

program
  .command('scratch', 'Scratch org management', { executableFile: 'scratch-org.js' });

program
  .command('deploy', 'Deployment utilities', { executableFile: 'deploy.js' });

program
  .command('test', 'Apex test runner', { executableFile: 'test-runner.js' });

program
  .command('artifact', 'Artifact management', { executableFile: 'artifact.js' });

program.parse();

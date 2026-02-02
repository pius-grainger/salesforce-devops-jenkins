#!/usr/bin/env node

/**
 * Updates the version number in sfdx-project.json to match the semantic release version.
 * This script is called by semantic-release during the prepare step.
 *
 * Usage: node scripts/update-sfdx-version.js <version>
 * Example: node scripts/update-sfdx-version.js 1.2.3
 */

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  console.error('Usage: node update-sfdx-version.js <version>');
  process.exit(1);
}

// Validate version format
if (!/^\d+\.\d+\.\d+(-\w+\.\d+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-prerelease.N');
  process.exit(1);
}

const projectPath = path.join(__dirname, '..', 'sfdx-project.json');

try {
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));

  // Update version in package directories
  if (project.packageDirectories && Array.isArray(project.packageDirectories)) {
    for (const pkg of project.packageDirectories) {
      if (pkg.versionNumber) {
        // SFDX version format: X.Y.Z.NEXT or X.Y.Z.BUILD
        // We update the major.minor.patch and keep NEXT for auto-increment
        const [major, minor, patch] = version.split(/[.-]/);
        pkg.versionNumber = `${major}.${minor}.${patch}.NEXT`;
        pkg.versionName = `ver ${major}.${minor}`;
        console.log(`Updated ${pkg.package || pkg.path}: ${pkg.versionNumber}`);
      }
    }
  }

  fs.writeFileSync(projectPath, JSON.stringify(project, null, 2) + '\n');
  console.log(`Successfully updated sfdx-project.json to version ${version}`);
} catch (error) {
  console.error(`Failed to update sfdx-project.json: ${error.message}`);
  process.exit(1);
}

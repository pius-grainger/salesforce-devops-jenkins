#!/usr/bin/env node

import { execSync } from 'child_process';
import { createReadStream, createWriteStream, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { Command } from 'commander';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import extract from 'extract-zip';
import type { ArtifactMetadata, EnvironmentConfig } from './types.js';

const PROJECT_ROOT = join(__dirname, '..', '..');
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');

function loadEnvironmentConfig(envName: string): EnvironmentConfig {
  const configPath = join(PROJECT_ROOT, 'config', 'environments', `${envName}.json`);
  if (!existsSync(configPath)) {
    throw new Error(`Environment config not found: ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, 'utf-8')) as EnvironmentConfig;
}

function loadSfdxProject(): { sourceApiVersion: string; packageDirectories: Array<{ path: string }> } {
  const projectPath = join(PROJECT_ROOT, 'sfdx-project.json');
  return JSON.parse(readFileSync(projectPath, 'utf-8'));
}

function getGitInfo(): { commit: string; branch: string } {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf-8', cwd: PROJECT_ROOT }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', cwd: PROJECT_ROOT }).trim();
    return { commit, branch };
  } catch {
    return { commit: 'unknown', branch: 'unknown' };
  }
}

function getPackageVersion(): string {
  const packagePath = join(PROJECT_ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  return pkg.version || '0.0.0';
}

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || 'eu-west-2',
  });
}

export async function packageArtifact(options: {
  version?: string;
  buildNumber?: string;
  outputDir?: string;
}): Promise<{ artifactPath: string; metadata: ArtifactMetadata }> {
  const version = options.version || getPackageVersion();
  const buildNumber = options.buildNumber || process.env.BUILD_NUMBER || Date.now().toString();
  const outputDir = options.outputDir || ARTIFACTS_DIR;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const gitInfo = getGitInfo();
  const sfdxProject = loadSfdxProject();

  const metadata: ArtifactMetadata = {
    version,
    buildNumber,
    gitCommit: gitInfo.commit,
    gitBranch: gitInfo.branch,
    timestamp: new Date().toISOString(),
    environment: 'packaged',
    sourceApiVersion: sfdxProject.sourceApiVersion,
    packageDirectories: sfdxProject.packageDirectories.map((p) => p.path),
  };

  const artifactName = `fcdo-sf-${version}-${buildNumber}.zip`;
  const artifactPath = join(outputDir, artifactName);
  const metadataPath = join(outputDir, `${artifactName}.metadata.json`);

  console.log(`\n${'='.repeat(60)}`);
  console.log('PACKAGING ARTIFACT');
  console.log(`${'='.repeat(60)}`);
  console.log(`Version: ${version}`);
  console.log(`Build: ${buildNumber}`);
  console.log(`Git Commit: ${gitInfo.commit}`);
  console.log(`Git Branch: ${gitInfo.branch}`);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(artifactPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`\nArtifact created: ${artifactPath}`);
      console.log(`Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);

    // Add force-app directory
    for (const pkgDir of sfdxProject.packageDirectories) {
      const dirPath = join(PROJECT_ROOT, pkgDir.path);
      if (existsSync(dirPath)) {
        archive.directory(dirPath, pkgDir.path);
      }
    }

    // Add sfdx-project.json
    archive.file(join(PROJECT_ROOT, 'sfdx-project.json'), { name: 'sfdx-project.json' });

    // Add metadata file
    archive.append(JSON.stringify(metadata, null, 2), { name: 'artifact-metadata.json' });

    archive.finalize();
  });

  // Write metadata file separately for easy access
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`Metadata written to: ${metadataPath}`);

  console.log(`${'='.repeat(60)}\n`);

  return { artifactPath, metadata };
}

export async function uploadArtifact(options: {
  artifactPath: string;
  environment: string;
}): Promise<string> {
  const config = loadEnvironmentConfig(options.environment);
  const s3Client = getS3Client();

  const artifactName = basename(options.artifactPath);
  const s3Key = `${config.s3ArtifactPath}/${artifactName}`;

  console.log(`\n${'='.repeat(60)}`);
  console.log('UPLOADING ARTIFACT TO S3');
  console.log(`${'='.repeat(60)}`);
  console.log(`Bucket: ${config.s3ArtifactBucket}`);
  console.log(`Key: ${s3Key}`);

  // Read artifact file
  const fileContent = readFileSync(options.artifactPath);

  // Read metadata if exists
  const metadataPath = `${options.artifactPath}.metadata.json`;
  let metadata: ArtifactMetadata | undefined;
  if (existsSync(metadataPath)) {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
  }

  // Upload artifact
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3ArtifactBucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/zip',
      Metadata: metadata
        ? {
            version: metadata.version,
            buildNumber: metadata.buildNumber,
            gitCommit: metadata.gitCommit,
            gitBranch: metadata.gitBranch,
            timestamp: metadata.timestamp,
          }
        : undefined,
    })
  );

  // Upload metadata file
  if (metadata) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3ArtifactBucket,
        Key: `${s3Key}.metadata.json`,
        Body: JSON.stringify(metadata, null, 2),
        ContentType: 'application/json',
      })
    );
  }

  const s3Url = `s3://${config.s3ArtifactBucket}/${s3Key}`;
  console.log(`\nArtifact uploaded: ${s3Url}`);
  console.log(`${'='.repeat(60)}\n`);

  return s3Url;
}

export async function downloadArtifact(options: {
  environment: string;
  version?: string;
  outputDir?: string;
}): Promise<string> {
  const config = loadEnvironmentConfig(options.environment);
  const s3Client = getS3Client();
  const outputDir = options.outputDir || ARTIFACTS_DIR;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('DOWNLOADING ARTIFACT FROM S3');
  console.log(`${'='.repeat(60)}`);
  console.log(`Bucket: ${config.s3ArtifactBucket}`);
  console.log(`Path: ${config.s3ArtifactPath}`);

  let artifactKey: string;

  if (options.version) {
    // Download specific version
    artifactKey = `${config.s3ArtifactPath}/fcdo-sf-${options.version}.zip`;
  } else {
    // Find latest artifact
    const listResult = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: config.s3ArtifactBucket,
        Prefix: `${config.s3ArtifactPath}/fcdo-sf-`,
      })
    );

    const artifacts = (listResult.Contents || [])
      .filter((obj) => obj.Key?.endsWith('.zip') && !obj.Key?.includes('.metadata'))
      .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

    if (artifacts.length === 0) {
      throw new Error(`No artifacts found in ${config.s3ArtifactBucket}/${config.s3ArtifactPath}`);
    }

    artifactKey = artifacts[0].Key!;
  }

  console.log(`Downloading: ${artifactKey}`);

  // Download artifact
  const getResult = await s3Client.send(
    new GetObjectCommand({
      Bucket: config.s3ArtifactBucket,
      Key: artifactKey,
    })
  );

  const artifactName = basename(artifactKey);
  const artifactPath = join(outputDir, artifactName);

  // Write to file
  const chunks: Uint8Array[] = [];
  for await (const chunk of getResult.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  writeFileSync(artifactPath, Buffer.concat(chunks));

  console.log(`Downloaded to: ${artifactPath}`);
  console.log(`${'='.repeat(60)}\n`);

  return artifactPath;
}

export async function extractArtifact(options: {
  artifactPath: string;
  outputDir?: string;
}): Promise<string> {
  const outputDir = options.outputDir || join(ARTIFACTS_DIR, 'extracted');

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Extracting: ${options.artifactPath}`);
  console.log(`To: ${outputDir}`);

  await extract(options.artifactPath, { dir: outputDir });

  console.log('Extraction complete');
  return outputDir;
}

export async function listArtifacts(environment: string): Promise<void> {
  const config = loadEnvironmentConfig(environment);
  const s3Client = getS3Client();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`ARTIFACTS IN ${environment.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Bucket: ${config.s3ArtifactBucket}`);
  console.log(`Path: ${config.s3ArtifactPath}\n`);

  const listResult = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: config.s3ArtifactBucket,
      Prefix: `${config.s3ArtifactPath}/fcdo-sf-`,
    })
  );

  const artifacts = (listResult.Contents || [])
    .filter((obj) => obj.Key?.endsWith('.zip') && !obj.Key?.includes('.metadata'))
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

  if (artifacts.length === 0) {
    console.log('No artifacts found');
    return;
  }

  for (const artifact of artifacts) {
    const name = basename(artifact.Key || '');
    const size = ((artifact.Size || 0) / 1024 / 1024).toFixed(2);
    const date = artifact.LastModified?.toISOString() || 'Unknown';
    console.log(`  ${name}`);
    console.log(`    Size: ${size} MB | Modified: ${date}`);
  }

  console.log(`\nTotal: ${artifacts.length} artifacts`);
  console.log(`${'='.repeat(60)}\n`);
}

// CLI interface
const program = new Command();

program
  .name('artifact')
  .description('Salesforce artifact management utilities')
  .version('1.0.0');

program
  .command('package')
  .description('Package Salesforce source as a deployable artifact')
  .option('-v, --version <version>', 'Artifact version')
  .option('-b, --build-number <number>', 'Build number')
  .option('-o, --output-dir <dir>', 'Output directory')
  .action(async (options) => {
    await packageArtifact({
      version: options.version,
      buildNumber: options.buildNumber,
      outputDir: options.outputDir,
    });
  });

program
  .command('upload')
  .description('Upload an artifact to S3')
  .requiredOption('-a, --artifact <path>', 'Path to artifact file')
  .requiredOption('-e, --env <environment>', 'Target environment')
  .action(async (options) => {
    await uploadArtifact({
      artifactPath: options.artifact,
      environment: options.env,
    });
  });

program
  .command('download')
  .description('Download an artifact from S3')
  .requiredOption('-e, --env <environment>', 'Source environment')
  .option('-v, --version <version>', 'Specific version to download')
  .option('-o, --output-dir <dir>', 'Output directory')
  .action(async (options) => {
    await downloadArtifact({
      environment: options.env,
      version: options.version,
      outputDir: options.outputDir,
    });
  });

program
  .command('extract')
  .description('Extract a downloaded artifact')
  .requiredOption('-a, --artifact <path>', 'Path to artifact file')
  .option('-o, --output-dir <dir>', 'Output directory')
  .action(async (options) => {
    await extractArtifact({
      artifactPath: options.artifact,
      outputDir: options.outputDir,
    });
  });

program
  .command('list')
  .description('List artifacts in an environment')
  .requiredOption('-e, --env <environment>', 'Environment to list')
  .action(async (options) => {
    await listArtifacts(options.env);
  });

program.parse();

# Deployment Guide

This document describes the deployment process and procedures for the Salesforce DevOps POC.

## Deployment Overview

### Environment Promotion Path

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Dev       │───▶│     QA      │───▶│ Production  │
│  Sandbox    │    │   Sandbox   │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
      │                  │                   │
      │                  │                   │
   Feature            Main               Release
   Branches          Branch                Tags
```

### Artifact-Based Promotion

All deployments use versioned artifacts stored in S3:

```
s3://sf-devops-artifacts/
├── dev/
│   └── sf-package-1.2.3-456.zip
├── qa/
│   └── sf-package-1.2.3-456.zip
└── prod/
    └── sf-package-1.2.3-456.zip
```

## Deployment Types

### 1. Feature Branch Deployment

**Trigger:** Push to `feature/*` or `bugfix/*` branch

**Target:** Scratch Org (temporary)

**Process:**
1. Create scratch org
2. Push source
3. Run Apex tests
4. Clean up scratch org

```bash
# Manual feature deployment
npm run scratch:create -- -a my-feature -d 1
sf project deploy start -o my-feature
npm run test:apex -- -o my-feature
```

### 2. Development Deployment

**Trigger:** Merge to `develop` branch

**Target:** Dev Sandbox

**Process:**
1. Validate deployment
2. Run Apex tests
3. Deploy metadata

```bash
# Manual dev deployment
npm run deploy:dev -- --check-only  # Validate first
npm run deploy:dev                   # Deploy
```

### 3. QA Deployment

**Trigger:** Merge to `main` branch

**Target:** QA Sandbox

**Process:**
1. Run semantic release
2. Package artifact
3. Upload to S3
4. Deploy to QA
5. Apply UI configurations
6. Run Provar tests

```bash
# Manual QA deployment
npm run deploy:qa
sf ui setup apply -o QAOrg -f config/ui-automation/qa-setup.json
```

### 4. Production Deployment

**Trigger:** Create release tag (`v*.*.*`)

**Target:** Production

**Requirements:**
- Manual approval required
- Only authorized personnel
- Within deployment window

**Process:**
1. Download artifact from QA
2. Deploy to production
3. Apply UI configurations
4. Run smoke tests
5. Archive to prod bucket

## Deployment Commands

### Check-Only Deployment (Validation)

Validate without deploying:

```bash
# Validate against specific org
sf project deploy start -o DevOrg --dry-run -l RunLocalTests

# Using npm script
npm run deploy:dev -- --check-only
```

### Full Deployment

```bash
# Deploy to dev
npm run deploy:dev

# Deploy to QA
npm run deploy:qa

# Deploy to production
npm run deploy:prod
```

### Quick Deploy

Deploy a previously validated deployment:

```bash
# After successful validation, get the deployment ID
sf project deploy quick -i <deploymentId> -o TargetOrg
```

## Artifact Management

### Creating Artifacts

```bash
# Package current source
npm run artifact:package -- -v 1.2.3 -b 456

# Output: artifacts/sf-package-1.2.3-456.zip
```

### Artifact Contents

```
sf-package-1.2.3-456.zip
├── force-app/           # Salesforce source
├── sfdx-project.json    # Project config
└── artifact-metadata.json
```

### Artifact Metadata

```json
{
  "version": "1.2.3",
  "buildNumber": "456",
  "gitCommit": "abc123...",
  "gitBranch": "main",
  "timestamp": "2024-01-15T10:30:00Z",
  "sourceApiVersion": "59.0"
}
```

### Uploading Artifacts

```bash
# Upload to QA bucket
npm run artifact:upload -- -a artifacts/sf-package-1.2.3-456.zip -e qa
```

### Downloading Artifacts

```bash
# Download latest from QA
npm run artifact:download -- -e qa

# Download specific version
npm run artifact:download -- -e qa -v 1.2.3-456
```

## Environment Configuration

### Dev Environment (`config/environments/dev.json`)

```json
{
  "name": "dev",
  "instanceUrl": "https://mycompany--dev.sandbox.my.salesforce.com",
  "username": "devops@mycompany.com.dev",
  "apexTestLevel": "RunLocalTests",
  "minCoveragePercent": 75,
  "runProvarTests": false
}
```

### QA Environment (`config/environments/qa.json`)

```json
{
  "name": "qa",
  "instanceUrl": "https://mycompany--qa.sandbox.my.salesforce.com",
  "username": "devops@mycompany.com.qa",
  "apexTestLevel": "RunLocalTests",
  "minCoveragePercent": 80,
  "runProvarTests": true,
  "provarTestSuite": "RegressionSuite"
}
```

### Production Environment (`config/environments/prod.json`)

```json
{
  "name": "prod",
  "instanceUrl": "https://mycompany.my.salesforce.com",
  "username": "devops@mycompany.com",
  "apexTestLevel": "RunLocalTests",
  "minCoveragePercent": 85,
  "requireApproval": true,
  "deploymentWindow": {
    "allowedDays": ["Saturday", "Sunday"],
    "allowedHours": { "start": "06:00", "end": "10:00" }
  }
}
```

## Deployment Checklist

### Pre-Deployment

- [ ] All tests pass in source environment
- [ ] Code coverage meets requirements
- [ ] No destructive changes without approval
- [ ] Deployment notes documented
- [ ] Rollback plan ready

### During Deployment

- [ ] Monitor deployment progress
- [ ] Check for component errors
- [ ] Verify test execution
- [ ] Watch for timeout issues

### Post-Deployment

- [ ] Verify all components deployed
- [ ] Run smoke tests
- [ ] Apply UI configurations
- [ ] Notify stakeholders
- [ ] Update deployment log

## Rollback Procedures

### Quick Rollback

If issues found immediately after deployment:

```bash
# Deploy previous version
npm run artifact:download -- -e prod -v <previous-version>
npm run deploy:prod
```

### Manual Rollback

For complex rollbacks:

1. Identify components to rollback
2. Create destructive changes manifest if needed
3. Deploy previous artifact
4. Verify functionality

### Destructive Changes

To remove components:

1. Create `destructiveChanges.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>ClassToDelete</members>
        <name>ApexClass</name>
    </types>
    <version>59.0</version>
</Package>
```

2. Deploy with destructive changes:

```bash
sf project deploy start -o TargetOrg --pre-destructive-changes destructiveChanges.xml
```

## Troubleshooting

### Deployment Failures

**Component errors:**
- Check component dependencies
- Verify API version compatibility
- Review validation errors

**Test failures:**
- Check test data setup
- Verify test isolation
- Review coverage requirements

**Timeout errors:**
- Increase deployment timeout
- Split large deployments
- Check org limits

### Common Issues

**"Cannot deploy to production"**
- Ensure all tests pass
- Verify coverage requirements
- Check deployment window

**"Component already exists"**
- Check for duplicate components
- Review package.xml

**"Missing dependency"**
- Check deployment order
- Include dependent components

## Security Considerations

### Credential Handling

- Never commit credentials
- Use SFDX auth URLs
- Rotate credentials regularly

### Deployment Permissions

- Principle of least privilege
- Separate service accounts per environment
- Audit deployment access

### Audit Trail

All deployments are tracked:
- S3 artifact versioning
- Jenkins build history
- Salesforce Setup Audit Trail

# Jenkins Pipeline Guide

This document describes the Jenkins CI/CD pipeline configuration and usage.

## Pipeline Overview

The pipeline is defined in `jenkins/Jenkinsfile` and implements a multi-stage deployment workflow.

## Pipeline Stages

### 1. Setup

**Triggers:** All branches

**Actions:**
- Install Node.js dependencies
- Build TypeScript projects
- Install Salesforce CLI
- Authenticate to Dev Hub

```groovy
stage('Setup') {
    steps {
        sh 'npm ci'
        sh 'npm run build'
        // Authenticate to Dev Hub
    }
}
```

### 2. Create Scratch Org

**Triggers:** Feature branches (`feature/*`, `bugfix/*`), Pull Requests

**Actions:**
- Create temporary scratch org
- Push source code
- Configure scratch org

```groovy
stage('Create Scratch Org') {
    when {
        anyOf {
            branch 'feature/*'
            branch 'bugfix/*'
            changeRequest()
        }
    }
}
```

### 3. Run Apex Tests

**Triggers:** All branches (parallel execution)

**Actions:**
- Execute Apex tests
- Generate coverage report
- Enforce 75% minimum coverage
- Output JUnit XML results

```groovy
stage('Run Apex Tests') {
    parallel {
        stage('Scratch Org Tests') { ... }
        stage('Dev Org Tests') { ... }
    }
}
```

### 4. Provar Regression Tests

**Triggers:** `develop`, `main`, `release/*` branches

**Actions:**
- Execute Provar test suite
- Generate JUnit results
- Archive screenshots and reports

```groovy
stage('Provar Regression Tests') {
    when {
        anyOf {
            branch 'develop'
            branch 'main'
            branch 'release/*'
        }
    }
}
```

### 5. Semantic Release

**Triggers:** `main` branch only

**Actions:**
- Analyze commits
- Determine version bump
- Update package.json and sfdx-project.json
- Generate CHANGELOG
- Create Git tag

### 6. Package Artifact

**Triggers:** `main`, `release/*` branches

**Actions:**
- Create versioned ZIP artifact
- Include metadata (git commit, timestamp)
- Archive in Jenkins

### 7. Upload to S3

**Triggers:** `main`, `release/*` branches

**Actions:**
- Upload artifact to environment bucket
- Store metadata alongside artifact

### 8. Deploy to QA

**Triggers:** `main` branch

**Actions:**
- Authenticate to QA org
- Deploy metadata
- Run post-deployment tests

### 9. Post-Deploy UI Configuration

**Triggers:** After QA deployment

**Actions:**
- Link custom SF CLI plugin
- Apply UI-based configurations
- Configure settings not available via Metadata API

### 10. Deploy to Production

**Triggers:** Release tags (`v*.*.*`)

**Requirements:**
- Manual approval required
- Authorized submitters only

**Actions:**
- Download artifact from QA bucket
- Deploy to production
- Archive to production bucket

## Required Jenkins Credentials

Create these credentials in Jenkins > Manage Jenkins > Credentials:

| ID | Type | Description |
|----|------|-------------|
| `sf-devhub-auth-url` | Secret text | SFDX auth URL for Dev Hub |
| `sf-dev-auth-url` | Secret text | SFDX auth URL for Dev sandbox |
| `sf-qa-auth-url` | Secret text | SFDX auth URL for QA sandbox |
| `sf-prod-auth-url` | Secret text | SFDX auth URL for Production |
| `aws-access-key-id` | Secret text | AWS access key ID |
| `aws-secret-access-key` | Secret text | AWS secret access key |
| `provar-license` | Secret text | Provar license key |

### Generating SFDX Auth URLs

```bash
# Authenticate to org
sf org login web -a MyOrg

# Get auth URL (save this as credential)
sf org display -o MyOrg --verbose --json | jq -r '.result.sfdxAuthUrl'
```

## Required Jenkins Plugins

- Pipeline
- Pipeline: Multibranch
- Credentials Binding
- NodeJS
- JUnit
- Slack Notification (optional)
- Email Extension (optional)
- AnsiColor

## Jenkins Agent Requirements

Label: `salesforce`

**Required software:**
- Node.js 18+
- Git
- Salesforce CLI
- ANT (for Provar)
- Chrome/Chromium (for Puppeteer)
- AWS CLI

## Pipeline Configuration

### Multibranch Pipeline Setup

1. Create new Multibranch Pipeline job
2. Configure Git source
3. Set Jenkinsfile path: `jenkins/Jenkinsfile`
4. Configure branch discovery

### Environment Variables

```groovy
environment {
    NODE_VERSION = '18'
    AWS_REGION = 'eu-west-2'
    PROVAR_HOME = '/opt/provar'
}
```

### Timeouts

| Stage | Timeout |
|-------|---------|
| Overall pipeline | 60 minutes |
| Production deployment | 24 hours (approval) |
| Individual stages | 30 minutes |

## Notifications

### Slack Integration

Configure Slack notifications in Jenkins:

1. Install Slack Notification plugin
2. Add Slack webhook credential
3. Configure channels in Jenkinsfile

**Channels:**
- `#sf-dev-deployments` - Development deployments
- `#sf-qa-deployments` - QA deployments
- `#sf-prod-deployments` - Production deployments

### Email Notifications

Production deployments send email notifications to:
- `sf-team@fcdo.gov.uk`

## Troubleshooting

### Common Issues

**Authentication failures:**
```bash
# Verify auth URL is valid
sf org login sfdx-url -f auth_url.txt -a TestOrg
```

**Build failures:**
```bash
# Check Node.js version
node --version  # Should be 18+

# Rebuild dependencies
rm -rf node_modules
npm ci
```

**Scratch org creation fails:**
```bash
# Check Dev Hub limits
sf org list limits -o DevHub

# Verify scratch org definition
sf org create scratch -f config/project-scratch-def.json --dry-run
```

### Viewing Logs

Access detailed logs:
1. Click on failed stage
2. View "Pipeline Steps"
3. Click on failed step for full output

### Manual Cleanup

If scratch orgs aren't cleaned up automatically:
```bash
# List scratch orgs
sf org list --all

# Delete specific scratch org
sf org delete scratch -o <username> -p
```

## Best Practices

1. **Commit Messages:** Use conventional commits for semantic versioning
2. **Feature Branches:** Always create from `main`
3. **Pull Requests:** Require passing pipeline before merge
4. **Credentials:** Never commit secrets to repository
5. **Artifacts:** Always verify artifact integrity before production

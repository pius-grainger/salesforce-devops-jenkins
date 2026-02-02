# Salesforce DevOps POC

A comprehensive proof-of-concept for Salesforce DevOps practices, featuring automated CI/CD pipelines, testing frameworks, and configuration management.

## Overview

This POC demonstrates enterprise-grade Salesforce DevOps practices for Salesforce, including:

- **Scratch Org Management** - Automated creation and lifecycle management
- **CI/CD Pipeline** - Jenkins-based multi-stage deployment pipeline
- **Automated Testing** - Apex tests, Provar regression, and Cypress E2E
- **Artifact Management** - S3-based versioned artifact promotion
- **Semantic Versioning** - Automated versioning for Node.js and Salesforce packages
- **UI Automation** - Custom SF CLI plugin for configurations not exposed via APIs

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| CI/CD | Jenkins |
| Testing | Apex, Provar, Cypress |
| Databases | PostgreSQL, Redis |
| Artifact Storage | AWS S3 |
| Versioning | Semantic Release |

## Quick Start

### Prerequisites

- Node.js 18+
- Salesforce CLI (`sf`)
- Jenkins (for CI/CD)
- AWS CLI (for S3 artifacts)
- Provar (for regression testing)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd salesforce-devops-poc

# Install dependencies
npm install

# Build all packages
npm run build

# Link the custom SF CLI plugin
npm run ui:install-plugin
```

### Authenticate to Salesforce

```bash
# Authenticate to Dev Hub
sf org login web -a DevHub -d

# Authenticate to target orgs
sf org login web -a DevOrg
sf org login web -a QAOrg
```

## Project Structure

```
salesforce-devops-poc/
├── force-app/              # Salesforce source (SFDX format)
├── scripts/                # TypeScript DevOps utilities
├── plugins/                # Custom Salesforce CLI plugins
│   └── sf-ui-automation/   # Puppeteer-based UI automation
├── config/                 # Configuration files
│   ├── environments/       # Environment-specific configs
│   └── ui-automation/      # UI automation configs
├── jenkins/                # Jenkins pipeline
├── provar/                 # Provar test project
├── cypress/                # Cypress E2E tests
└── docs/                   # Documentation
```

## Documentation

- [Architecture Overview](docs/architecture.md)
- [Jenkins Pipeline Guide](docs/jenkins-pipeline.md)
- [UI Automation Plugin](docs/ui-automation.md)
- [Testing Strategy](docs/testing.md)
- [Deployment Guide](docs/deployment.md)

## Available Commands

### Scratch Org Management

```bash
# Create a scratch org
npm run scratch:create -- -a my-scratch -d 7

# Delete a scratch org
npm run scratch:delete -- -o my-scratch
```

### Deployment

```bash
# Deploy to Dev
npm run deploy:dev

# Deploy to QA
npm run deploy:qa

# Deploy to Production (requires approval)
npm run deploy:prod
```

### Testing

```bash
# Run Apex tests
npm run test:apex -- -o DevOrg

# Run Provar regression tests
npm run test:provar

# Run Cypress E2E tests
npm run test:e2e
```

### Artifact Management

```bash
# Package artifact
npm run artifact:package -- -v 1.0.0 -b 123

# Upload to S3
npm run artifact:upload -- -a artifacts/sf-package-1.0.0-123.zip -e qa

# Download from S3
npm run artifact:download -- -e qa -v 1.0.0
```

### UI Automation

```bash
# Configure session settings
sf ui config session -o QAOrg --timeout 120 --lock-ip

# Configure sharing settings
sf ui config sharing -o QAOrg --object Case --internal Private

# Activate a Flow
sf ui setup flow -o QAOrg --flow-name My_Flow --activate

# Apply bulk configuration
sf ui setup apply -o QAOrg -f config/ui-automation/qa-setup.json
```

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Feature Branch                               │
├─────────────────────────────────────────────────────────────────┤
│  Build → Create Scratch Org → Run Apex Tests → Provar Tests     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Main Branch                                 │
├─────────────────────────────────────────────────────────────────┤
│  Build → Apex Tests → Provar → Semantic Release → Package →     │
│  Upload S3 → Deploy QA → UI Configuration                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Release Tag (v*.*.*)                          │
├─────────────────────────────────────────────────────────────────┤
│  Download Artifact → Deploy Production (with approval)          │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Configuration

Configure environment-specific settings in `config/environments/`:

| File | Purpose |
|------|---------|
| `dev.json` | Development sandbox settings |
| `qa.json` | QA sandbox settings |
| `prod.json` | Production settings |

## Jenkins Setup

Required Jenkins credentials:

| Credential ID | Description |
|---------------|-------------|
| `sf-devhub-auth-url` | Dev Hub SFDX auth URL |
| `sf-dev-auth-url` | Dev sandbox auth URL |
| `sf-qa-auth-url` | QA sandbox auth URL |
| `sf-prod-auth-url` | Production auth URL |
| `aws-access-key-id` | AWS access key |
| `aws-secret-access-key` | AWS secret key |
| `provar-license` | Provar license key |

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit using conventional commits
3. Push and create a Pull Request
4. Pipeline will run automated tests
5. Merge after approval and passing tests

## License

Internal use only - Salesforce

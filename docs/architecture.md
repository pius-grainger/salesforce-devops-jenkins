# Architecture Overview

This document describes the architecture of the FCDO Salesforce DevOps POC.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            Developer Workflow                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│   │  Code   │───▶│  Commit │───▶│  Push   │───▶│   PR    │              │
│   │ Changes │    │ (Conv.) │    │         │    │ Review  │              │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          Jenkins CI/CD Pipeline                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│   │  Build  │───▶│  Test   │───▶│ Package │───▶│ Deploy  │              │
│   │         │    │ (Apex)  │    │         │    │         │              │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘              │
│                       │                             │                    │
│                       ▼                             ▼                    │
│                 ┌─────────┐                   ┌─────────┐                │
│                 │ Provar  │                   │   UI    │                │
│                 │  Tests  │                   │ Config  │                │
│                 └─────────┘                   └─────────┘                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Salesforce Environments                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│   │   Scratch   │    │     QA      │    │ Production  │                 │
│   │    Orgs     │    │   Sandbox   │    │             │                 │
│   └─────────────┘    └─────────────┘    └─────────────┘                 │
│         │                  │                   │                         │
│         └──────────────────┴───────────────────┘                         │
│                            │                                             │
│                            ▼                                             │
│                    ┌─────────────┐                                       │
│                    │   Dev Hub   │                                       │
│                    └─────────────┘                                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. DevOps Scripts (`scripts/`)

TypeScript-based CLI utilities for Salesforce operations:

```
scripts/
├── src/
│   ├── types.ts           # Shared TypeScript interfaces
│   ├── scratch-org.ts     # Scratch org lifecycle management
│   ├── deploy.ts          # Deployment orchestration
│   ├── test-runner.ts     # Apex test execution
│   └── artifact.ts        # S3 artifact management
├── package.json
└── tsconfig.json
```

**Key Features:**
- Modular, testable code
- Consistent error handling
- JUnit XML output for Jenkins
- S3 integration for artifacts

### 2. Custom SF CLI Plugin (`plugins/sf-ui-automation/`)

Puppeteer-based plugin for UI automation:

```
sf-ui-automation/
├── src/
│   ├── lib/
│   │   ├── browser.ts           # Browser lifecycle management
│   │   └── setup-automations.ts # Salesforce UI interactions
│   └── commands/
│       └── ui/
│           ├── config/          # Configuration commands
│           └── setup/           # Setup commands
├── package.json
└── tsconfig.json
```

**Supported Operations:**
- Session security settings
- Organization-Wide Defaults
- Flow activation/deactivation
- Einstein Activity Capture
- Omni-Channel configuration

### 3. Salesforce Source (`force-app/`)

Standard SFDX source format:

```
force-app/
└── main/
    └── default/
        ├── classes/       # Apex classes
        ├── triggers/      # Apex triggers
        ├── lwc/           # Lightning Web Components
        └── objects/       # Custom objects/fields
```

### 4. Testing Framework

#### Apex Tests
- Located in `force-app/main/default/classes/*Test.cls`
- Minimum 75% coverage enforced
- JUnit XML output for Jenkins

#### Provar Tests
- Located in `provar/tests/`
- Regression and smoke test suites
- ANT-based execution

#### Cypress E2E Tests
- Located in `cypress/e2e/`
- Custom Salesforce commands
- Session-based authentication

## Data Flow

### Artifact Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Source    │───▶│   Package   │───▶│   Upload    │
│   Code      │    │  (ZIP)      │    │   to S3     │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
                   ┌────────────────────────┼────────────────────────┐
                   │                        │                        │
                   ▼                        ▼                        ▼
            ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
            │  s3://dev/  │          │  s3://qa/   │          │  s3://prod/ │
            └─────────────┘          └─────────────┘          └─────────────┘
```

### Authentication Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Jenkins    │───▶│  Auth URL   │───▶│  SF CLI     │
│ Credentials │    │  Secret     │    │  Session    │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
                                      ┌─────────────┐
                                      │  Salesforce │
                                      │     Org     │
                                      └─────────────┘
```

## Security Considerations

### Credential Management
- All credentials stored in Jenkins Credential Store
- SFDX auth URLs used (not username/password)
- AWS credentials with minimal required permissions

### Network Security
- HTTPS enforced for all connections
- Session cookies marked HttpOnly
- IP locking available for sessions

### Code Security
- No secrets in source control
- Environment-specific configs externalized
- Audit trail via S3 artifact versioning

## Scalability

### Horizontal Scaling
- Jenkins agents can be scaled for parallel builds
- S3 provides unlimited artifact storage
- Scratch orgs isolated per build

### Vertical Scaling
- Puppeteer memory configurable
- Apex test parallelization supported
- Provar test distribution available

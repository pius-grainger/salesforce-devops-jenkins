export interface EnvironmentConfig {
  name: string;
  displayName: string;
  instanceUrl: string;
  username: string;
  deployOnPush: boolean;
  runApexTests: boolean;
  apexTestLevel: 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';
  minCoveragePercent: number;
  runProvarTests: boolean;
  provarTestSuite: string | null;
  s3ArtifactBucket: string;
  s3ArtifactPath: string;
  requireApproval?: boolean;
  approvers?: string[];
  deploymentWindow?: {
    allowedDays: string[];
    allowedHours: {
      start: string;
      end: string;
    };
    timezone: string;
  };
  notifications?: {
    slack?: {
      channel: string;
      onSuccess: boolean;
      onFailure: boolean;
    };
    email?: {
      recipients: string[];
      onSuccess: boolean;
      onFailure: boolean;
    };
  };
}

export interface ScratchOrgConfig {
  orgName: string;
  edition: string;
  features: string[];
  settings: Record<string, unknown>;
}

export interface DeployResult {
  success: boolean;
  deployId: string;
  componentSuccesses: number;
  componentFailures: number;
  testsPassed: number;
  testsFailed: number;
  codeCoverage: number;
  errors: DeployError[];
}

export interface DeployError {
  componentType: string;
  fullName: string;
  problem: string;
  line?: number;
  column?: number;
}

export interface ApexTestResult {
  success: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  codeCoverage: number;
  coverageByClass: ClassCoverage[];
  testResults: TestMethodResult[];
  duration: number;
}

export interface ClassCoverage {
  name: string;
  coveredLines: number;
  uncoveredLines: number;
  coveragePercent: number;
}

export interface TestMethodResult {
  className: string;
  methodName: string;
  outcome: 'Pass' | 'Fail' | 'Skip';
  message?: string;
  stackTrace?: string;
  duration: number;
}

export interface ArtifactMetadata {
  version: string;
  buildNumber: string;
  gitCommit: string;
  gitBranch: string;
  timestamp: string;
  environment: string;
  sourceApiVersion: string;
  packageDirectories: string[];
}

export interface ScratchOrgResult {
  success: boolean;
  orgId?: string;
  username?: string;
  instanceUrl?: string;
  loginUrl?: string;
  expirationDate?: string;
  error?: string;
}

# Testing Strategy

This document describes the testing approach for the FCDO Salesforce DevOps POC.

## Testing Pyramid

```
                    ┌─────────────┐
                    │    E2E      │  ← Cypress, Provar
                    │   Tests     │
                    ├─────────────┤
                    │ Integration │  ← Apex Tests
                    │   Tests     │
                    ├─────────────┤
                    │    Unit     │  ← Apex Unit Tests
                    │   Tests     │
                    └─────────────┘
```

## Test Types

### 1. Apex Unit Tests

**Location:** `force-app/main/default/classes/*Test.cls`

**Purpose:** Test individual Apex methods and classes in isolation.

**Requirements:**
- Minimum 75% code coverage
- All tests must pass
- Use `@isTest` annotation
- Include positive and negative test cases

**Example:**

```apex
@isTest
private class AccountServiceTest {

    @TestSetup
    static void setupTestData() {
        // Create test data
        Account testAccount = new Account(Name = 'Test');
        insert testAccount;
    }

    @isTest
    static void testCreateAccount_Success() {
        Test.startTest();
        Account result = AccountService.createAccount('New Account');
        Test.stopTest();

        System.assertNotEquals(null, result.Id);
        System.assertEquals('New Account', result.Name);
    }

    @isTest
    static void testCreateAccount_BlankName_ThrowsException() {
        Test.startTest();
        try {
            AccountService.createAccount('');
            System.assert(false, 'Expected exception');
        } catch (AccountService.AccountServiceException e) {
            System.assertEquals('Account name cannot be blank', e.getMessage());
        }
        Test.stopTest();
    }
}
```

**Best Practices:**
- Use `@TestSetup` for common test data
- Test both happy path and error scenarios
- Use meaningful assertions with messages
- Avoid hardcoded IDs

### 2. Provar Regression Tests

**Location:** `provar/tests/`

**Purpose:** Automated UI testing for business processes and regression coverage.

**Test Suites:**

| Suite | Purpose | When Run |
|-------|---------|----------|
| `SmokeTestSuite` | Basic functionality verification | Every deployment |
| `RegressionSuite` | Full regression coverage | Pre-production |

**Example Test Case:**

```xml
<testCase>
    <summary>
        <name>AccountCreationTest</name>
        <description>Verify Account creation workflow</description>
    </summary>
    <steps>
        <step type="UIAction">
            <action>Open</action>
            <target>connection://Salesforce</target>
        </step>
        <step type="UIAction">
            <action>Click</action>
            <target>//a[@title='New']</target>
        </step>
        <!-- ... more steps ... -->
        <step type="Assertion">
            <assertionType>ElementPresent</assertionType>
            <target>//span[contains(text(), 'was created')]</target>
        </step>
    </steps>
</testCase>
```

**Running Provar Tests:**

```bash
# Run regression suite
npm run test:provar

# Run specific suite
ant -f provar/build.xml run-tests -DtestSuite=SmokeTestSuite
```

### 3. Cypress E2E Tests

**Location:** `cypress/e2e/`

**Purpose:** End-to-end testing for connected applications and integrations.

**Configuration:** `cypress.config.ts`

**Example Test:**

```typescript
describe('Account Management', () => {
  beforeEach(() => {
    cy.sfLogin();
  });

  it('should create a new Account', () => {
    cy.sfNavigateToObject('Account');
    cy.sfClickButton('New');

    cy.get('input[name="Name"]').type('Test Account');
    cy.sfClickButton('Save');

    cy.contains('.toastMessage', 'was created').should('be.visible');
  });
});
```

**Custom Salesforce Commands:**

| Command | Description |
|---------|-------------|
| `cy.sfLogin()` | Authenticate to Salesforce |
| `cy.sfNavigateToObject(name)` | Navigate to object list |
| `cy.sfClickButton(label)` | Click Lightning button |
| `cy.sfSetField(label, value)` | Set form field |
| `cy.sfWaitForPageLoad()` | Wait for Lightning page |

**Running Cypress Tests:**

```bash
# Run all E2E tests
npm run test:e2e

# Open Cypress UI
npx cypress open

# Run specific spec
npx cypress run --spec "cypress/e2e/account.cy.ts"
```

## Test Coverage

### Coverage Requirements

| Environment | Minimum Coverage |
|-------------|------------------|
| Development | 75% |
| QA | 80% |
| Production | 85% |

### Measuring Coverage

```bash
# Run tests with coverage
npm run test:apex -- -o DevOrg -l RunLocalTests -m 75

# View coverage report
cat test-results/coverage-report.txt
```

### Coverage Report Format

```
APEX CODE COVERAGE REPORT
============================================================
Overall Coverage: 82%

Coverage by Class:
------------------------------------------------------------
AccountService                   ████████████████░░░░  80%
ContactService                   ██████████████████░░  90%
CaseService                      ██████████████░░░░░░  70% (LOW)
```

## Test Data Management

### Test Data Strategy

1. **@TestSetup Methods:** Create reusable test data
2. **Test Factories:** Centralized test data creation
3. **Data Isolation:** Each test should be independent
4. **Cleanup:** Delete test data after E2E tests

### Example Test Factory

```apex
@isTest
public class TestDataFactory {

    public static Account createAccount(String name) {
        Account acc = new Account(
            Name = name,
            Type = 'Customer',
            Industry = 'Government'
        );
        insert acc;
        return acc;
    }

    public static List<Contact> createContacts(Id accountId, Integer count) {
        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < count; i++) {
            contacts.add(new Contact(
                FirstName = 'Test',
                LastName = 'Contact ' + i,
                AccountId = accountId,
                Email = 'test' + i + '@example.com'
            ));
        }
        insert contacts;
        return contacts;
    }
}
```

## CI/CD Integration

### Jenkins Test Stages

```groovy
stage('Run Apex Tests') {
    steps {
        sh 'npm run test:apex -- -o DevOrg -l RunLocalTests -m 75'
    }
    post {
        always {
            junit 'test-results/junit-results.xml'
        }
    }
}

stage('Provar Regression Tests') {
    steps {
        sh 'ant -f provar/build.xml run-tests'
    }
    post {
        always {
            junit 'provar/Results/**/*.xml'
            archiveArtifacts 'provar/Results/**/*'
        }
    }
}
```

### Test Results in Jenkins

All test frameworks output JUnit XML format:
- Apex tests: `test-results/junit-results.xml`
- Provar tests: `provar/Results/**/*.xml`
- Cypress tests: Configured in `cypress.config.ts`

## Quality Gates

### Pipeline Quality Gates

| Gate | Criteria | Action on Failure |
|------|----------|-------------------|
| Apex Tests | All pass | Block deployment |
| Code Coverage | ≥ 75% | Block deployment |
| Provar Regression | All pass | Block deployment |
| Cypress E2E | All pass | Block deployment |

### Pre-Commit Checks

Consider adding pre-commit hooks for:
- Apex class syntax validation
- Test class naming conventions
- Code coverage estimation

## Troubleshooting

### Common Test Failures

**"INSUFFICIENT_ACCESS"**
- Check user permissions in test context
- Use `System.runAs()` for permission testing

**"MIXED_DML_OPERATION"**
- Separate setup DML from test DML
- Use `Test.startTest()` / `Test.stopTest()`

**Cypress timeout**
- Increase default timeout in config
- Check for Lightning page load issues
- Verify session is still valid

**Provar element not found**
- Update element locators
- Check for UI changes
- Verify test environment state

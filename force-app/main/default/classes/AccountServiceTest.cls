/**
 * @description Test class for AccountService
 * @author FCDO DevOps Team
 */
@isTest
private class AccountServiceTest {

    @TestSetup
    static void setupTestData() {
        // Create test accounts
        List<Account> testAccounts = new List<Account>();

        for (Integer i = 0; i < 5; i++) {
            testAccounts.add(new Account(
                Name = 'Test Account ' + i,
                Type = i < 3 ? 'Customer' : 'Partner',
                Industry = 'Government'
            ));
        }

        insert testAccounts;

        // Create test contacts
        List<Contact> testContacts = new List<Contact>();
        Account firstAccount = testAccounts[0];

        for (Integer i = 0; i < 3; i++) {
            testContacts.add(new Contact(
                FirstName = 'Test',
                LastName = 'Contact ' + i,
                AccountId = firstAccount.Id,
                Email = 'test' + i + '@example.com'
            ));
        }

        insert testContacts;
    }

    @isTest
    static void testCreateAccount_Success() {
        Test.startTest();
        Account result = AccountService.createAccount('New Test Account');
        Test.stopTest();

        System.assertNotEquals(null, result.Id, 'Account should be created with an Id');
        System.assertEquals('New Test Account', result.Name, 'Account name should match');
        System.assertEquals('Prospect', result.Type, 'Account type should be Prospect');
        System.assertEquals('Government', result.Industry, 'Account industry should be Government');
    }

    @isTest
    static void testCreateAccount_BlankName() {
        Test.startTest();
        try {
            AccountService.createAccount('');
            System.assert(false, 'Expected AccountServiceException to be thrown');
        } catch (AccountService.AccountServiceException e) {
            System.assertEquals('Account name cannot be blank', e.getMessage(),
                'Exception message should match');
        }
        Test.stopTest();
    }

    @isTest
    static void testCreateAccount_NullName() {
        Test.startTest();
        try {
            AccountService.createAccount(null);
            System.assert(false, 'Expected AccountServiceException to be thrown');
        } catch (AccountService.AccountServiceException e) {
            System.assertEquals('Account name cannot be blank', e.getMessage(),
                'Exception message should match');
        }
        Test.stopTest();
    }

    @isTest
    static void testUpdateBillingAddress() {
        Account testAccount = [SELECT Id FROM Account LIMIT 1];

        Test.startTest();
        Account result = AccountService.updateBillingAddress(
            testAccount.Id,
            '123 Test Street',
            'London',
            'Greater London',
            'SW1A 1AA',
            'United Kingdom'
        );
        Test.stopTest();

        System.assertEquals('123 Test Street', result.BillingStreet, 'Street should be updated');
        System.assertEquals('London', result.BillingCity, 'City should be updated');
        System.assertEquals('Greater London', result.BillingState, 'State should be updated');
        System.assertEquals('SW1A 1AA', result.BillingPostalCode, 'Postal code should be updated');
        System.assertEquals('United Kingdom', result.BillingCountry, 'Country should be updated');
    }

    @isTest
    static void testGetAccountsByType_Customer() {
        Test.startTest();
        List<Account> results = AccountService.getAccountsByType('Customer');
        Test.stopTest();

        System.assertEquals(3, results.size(), 'Should return 3 Customer accounts');
        for (Account acc : results) {
            System.assertEquals('Customer', acc.Type, 'All accounts should be Customer type');
        }
    }

    @isTest
    static void testGetAccountsByType_Partner() {
        Test.startTest();
        List<Account> results = AccountService.getAccountsByType('Partner');
        Test.stopTest();

        System.assertEquals(2, results.size(), 'Should return 2 Partner accounts');
        for (Account acc : results) {
            System.assertEquals('Partner', acc.Type, 'All accounts should be Partner type');
        }
    }

    @isTest
    static void testGetAccountsByType_NoResults() {
        Test.startTest();
        List<Account> results = AccountService.getAccountsByType('Competitor');
        Test.stopTest();

        System.assertEquals(0, results.size(), 'Should return empty list for non-existent type');
    }

    @isTest
    static void testMarkAccountsAsActive() {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 3];
        List<Id> accountIds = new List<Id>();
        for (Account acc : accounts) {
            accountIds.add(acc.Id);
        }

        Test.startTest();
        Integer result = AccountService.markAccountsAsActive(accountIds);
        Test.stopTest();

        System.assertEquals(3, result, 'Should return count of updated accounts');

        List<Account> updatedAccounts = [
            SELECT Id, Active__c
            FROM Account
            WHERE Id IN :accountIds
        ];

        for (Account acc : updatedAccounts) {
            System.assertEquals('Yes', acc.Active__c, 'Account should be marked as active');
        }
    }

    @isTest
    static void testMarkAccountsAsActive_EmptyList() {
        Test.startTest();
        Integer result = AccountService.markAccountsAsActive(new List<Id>());
        Test.stopTest();

        System.assertEquals(0, result, 'Should return 0 for empty list');
    }

    @isTest
    static void testMarkAccountsAsActive_NullList() {
        Test.startTest();
        Integer result = AccountService.markAccountsAsActive(null);
        Test.stopTest();

        System.assertEquals(0, result, 'Should return 0 for null list');
    }

    @isTest
    static void testGetContactCount() {
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account 0' LIMIT 1];

        Test.startTest();
        Integer result = AccountService.getContactCount(testAccount.Id);
        Test.stopTest();

        System.assertEquals(3, result, 'Should return 3 contacts for test account');
    }

    @isTest
    static void testGetContactCount_NoContacts() {
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account 4' LIMIT 1];

        Test.startTest();
        Integer result = AccountService.getContactCount(testAccount.Id);
        Test.stopTest();

        System.assertEquals(0, result, 'Should return 0 for account with no contacts');
    }
}

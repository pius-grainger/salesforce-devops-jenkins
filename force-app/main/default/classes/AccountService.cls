/**
 * @description Service class for Account-related business logic
 * @author DevOps Team
 */
public with sharing class AccountService {

    /**
     * @description Creates a new Account with the given name
     * @param accountName The name for the new Account
     * @return The created Account record
     * @throws AccountServiceException if accountName is blank
     */
    public static Account createAccount(String accountName) {
        if (String.isBlank(accountName)) {
            throw new AccountServiceException('Account name cannot be blank');
        }

        Account acc = new Account(
            Name = accountName,
            Type = 'Prospect',
            Industry = 'Government'
        );

        insert acc;
        return acc;
    }

    /**
     * @description Updates an Account's billing address
     * @param accountId The Id of the Account to update
     * @param street Billing street address
     * @param city Billing city
     * @param state Billing state/province
     * @param postalCode Billing postal/zip code
     * @param country Billing country
     * @return The updated Account record
     */
    public static Account updateBillingAddress(
        Id accountId,
        String street,
        String city,
        String state,
        String postalCode,
        String country
    ) {
        Account acc = [
            SELECT Id, Name, BillingStreet, BillingCity, BillingState,
                   BillingPostalCode, BillingCountry
            FROM Account
            WHERE Id = :accountId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];

        acc.BillingStreet = street;
        acc.BillingCity = city;
        acc.BillingState = state;
        acc.BillingPostalCode = postalCode;
        acc.BillingCountry = country;

        update acc;
        return acc;
    }

    /**
     * @description Retrieves Accounts by type
     * @param accountType The Account type to filter by
     * @return List of matching Account records
     */
    public static List<Account> getAccountsByType(String accountType) {
        return [
            SELECT Id, Name, Type, Industry, BillingCity, BillingCountry
            FROM Account
            WHERE Type = :accountType
            WITH SECURITY_ENFORCED
            ORDER BY Name ASC
            LIMIT 1000
        ];
    }

    /**
     * @description Marks Accounts as active based on recent activity
     * @param accountIds List of Account Ids to evaluate
     * @return Number of Accounts marked as active
     */
    public static Integer markAccountsAsActive(List<Id> accountIds) {
        if (accountIds == null || accountIds.isEmpty()) {
            return 0;
        }

        List<Account> accountsToUpdate = new List<Account>();

        for (Id accId : accountIds) {
            accountsToUpdate.add(new Account(
                Id = accId,
                Active__c = 'Yes'
            ));
        }

        update accountsToUpdate;
        return accountsToUpdate.size();
    }

    /**
     * @description Calculates the total number of Contacts for an Account
     * @param accountId The Account Id
     * @return The contact count
     */
    public static Integer getContactCount(Id accountId) {
        return [
            SELECT COUNT()
            FROM Contact
            WHERE AccountId = :accountId
            WITH SECURITY_ENFORCED
        ];
    }

    /**
     * @description Custom exception for AccountService errors
     */
    public class AccountServiceException extends Exception {}
}

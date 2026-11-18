# Check an account's balance

Reconciling compares the balance equori calculates with the balance the institution shows. When they match, you know nothing was left out.

## How to reconcile

![Video: checking the balance of an account, up to the comparison](check-balance.webm)

1. Open the account in [Accounts](/accounts).
   ![The list of accounts, with the account to open marked](check-account)
2. Choose **Record balance**.
   ![The account page, with the Record balance button marked](check-open)
3. Enter the date and the balance the institution shows on that date. For a card or a debt, it is the amount owed.
   ![The dialog for the institution's balance, with the date and the balance marked](check-values)
4. Choose **Compare and reconcile**.
   ![The dialog for the institution's balance, with the Compare and reconcile button marked](check-compare)

The comparison uses the **cleared** balance at the end of the date: pending transactions stay out.

## What can happen

- **The balances match**: the account is reconciled up to that date. The transactions up to there become **Reconciled**.
- **There is a difference**: it stays open in the **Reconciliation** tab until you choose what to do:
  - record the missing transactions and choose **I recorded what was missing**;
  - **Record yield**, when the difference is a yield the institution paid;
  - **Record adjustment**, when the difference has no explanation and should be accepted.

![The Reconciliation tab, with the open difference marked](check-difference "The open difference stands at the top of the tab, with the actions that settle it.")

The tab also lists the **transactions without confirmation**: the ones that do not appear in the institution's statement. A duplicated or mistyped transaction is resolved by voiding or correcting it.

## Correct a reconciled transaction

A reconciled transaction cannot be changed. To correct it, choose **Unlock reconciliation** in the account's menu and enter the date to unlock from. The reconciliations from that date are deleted, and the transactions can be corrected again.

A **Balance assertion** records the balance your bank reports for an account at a date. When equori's balance matches, the account is reconciled up to that date: its postings become reconciled. When it differs, the **Difference** stays open until you record the missing transactions, post it as yield, or post it as an adjustment.

**Reconciliation** of a card statement confirms the amount due the bank charges. Unlocking returns reconciled postings from a date to cleared so you can correct them.

Reconcile on the Account screen; statements on Statement. On the Account screen, a selection of transactions without confirmation is voided in one step with one reason.

The tools. reconcile_account takes account_id and action. record_balance records what the institution reports: date and amount, negative for a debt; the difference from the balance of the book stays open until it is resolved. resolve_difference closes the open difference with resolution: adjustment posts it to Adjustments, yield posts it to Yield, and transactions_added checks again after the missing transactions were recorded. unlock opens the reconciled postings from date on, so that they can change. get_account_details shows the reconciliation state and the recorded balances of an account.

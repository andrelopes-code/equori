# Create a category rule

A rule gives a transaction the right category as soon as it arrives, imported or recorded by hand.

## Build the rule

1. In [Categories](/categories), open the **Rules** tab and choose **New rule**.
2. Under **If the transaction**, add the conditions: for example, the description contains a word, or the amount falls in a range. Every condition must hold at the same time. Text comparisons ignore case and accents.
3. Under **Then**, add the actions: the category, the payee, the tags or the split between categories. The actions apply in the order of the list.
4. Check the preview: it shows how many transactions of the last year the rule would categorize, and how many already categorized ones it would change.
5. Choose **Save rule**.

In amounts, money out is negative, as on the bank statement.

## The order of the rules

Rules run in the order of the list. Check **Stop the rules after this one when it matches** so that no later rule changes the transaction. Use **Move to the top** to give a rule priority.

## Apply to existing transactions

**Run rules** applies the rules to the transactions still without a category. Transactions that already have one do not change.

equori also suggests rules from the categories you choose by hand. A suggestion becomes a rule when you choose **Create rule**.

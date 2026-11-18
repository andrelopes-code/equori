A **Categorization rule** sets the category, the payee or tags of transactions whose fields match its conditions, such as a description containing "uber". Rules run by priority when transactions are imported or captured, and on request over every uncategorized transaction. equori suggests rules from your repeated manual corrections.

A **Payee** is who you pay or who pays you. list_payees_and_tags lists payees, tags in use and institutions; with kind tag_usage and query as the exact tag name it counts the transactions that carry the tag. A payee alias maps raw bank descriptions to a payee. A **Tag** is a free label on a transaction.

Manage rules on Rules, New rule and Rule; payees and aliases on Payees.

The tools. list_rules lists, by kind: rules (by priority; rule_id returns one), suggestions (rules suggested from repeated corrections), source_categories (the categories a bank connection assigned to imported lines) and payee_aliases. explain_categorization answers, by view: transactions (how each of transaction_ids got its category: a rule, a source category, the history or by hand), statistics (transactions by method from from to to) and rule_preview (what a rule with description_contains and category_id would categorize). Read rule_preview before proposing a rule.

manage_rule changes the automatic categorization; action names the operation.

- create_rule: name, and either the short form, description_contains with category_id and optionally payee_id, or the full form, conditions with actions. change_rule: rule_id and what changes. delete_rule: rule_id. enabled says whether the rule runs (true on create); stop_processing skips the later rules once this one matched.
- A condition is one text of three parts, field then operator then value, and all conditions of a rule must hold. Fields: description, raw_description (the text of the bank before any cleaning), payee, amount (signed), absolute_amount, account, account_kind, source, weekday, day_of_month and installment. Operators: equals, contains, starts_with, regex, between, greater_than, less_than and in_list. between and in_list join their values with a bar between spaces, as in "10.00 BRL | 50.00 BRL"; an amount is written with its currency, as in 10.00 BRL.
- An action is one text of two parts, type then target: set_category with a category ID, set_payee with a payee ID, add_tags with tags separated by commas, transfer with the ID of another own account, which turns the category side into a transfer, and mark_reimbursable with the ID of the account that holds what is to be reimbursed. A rule has at most one of set_category, transfer and mark_reimbursable. A rule that splits a transaction among categories is created on the Rule screen.
- reorder_rules: rule_ids with every rule in the new order; the first that matches decides.
- accept_suggestion: suggestion_id, optionally with a name. dismiss_suggestion: suggestion_id.
- run_rules runs the rules over every uncategorized transaction.
- map_source_category: source_category_id and category_id, the category that lines of that source category receive.
- create_alias: pattern, match_type (equals, starts_with or contains) and payee_id. change_alias: alias_id and what changes. delete_alias: alias_id.

A rule acts on transactions imported or captured after it, and on the uncategorized ones when the rules run; a transaction already categorized is changed with categorize_transactions.

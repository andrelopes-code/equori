-- +goose Up
-- Fixed income complete A236 FC25 (amended 2026-11-18): the income tax a fund withholds by
-- cancelling units is a credit of the book, held by the system account prepaid_tax that the first unit tax creates.
ALTER TABLE ledger_account DROP CONSTRAINT ledger_account_system_role_check;
ALTER TABLE ledger_account ADD CONSTRAINT ledger_account_system_role_check CHECK (system_role IN (
    'opening_balances', 'adjustments', 'uncategorized_expense', 'uncategorized_income', 'yield', 'discounts',
    'interest', 'taxes', 'fees', 'realized_gains', 'realized_losses', 'transfers_in_transit', 'prepaid_tax'));

ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_kind_check;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_kind_check
    CHECK (kind IN ('split', 'reverse_split', 'bonus', 'unit_tax'));
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_check2;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_value
    CHECK (kind IN ('bonus', 'unit_tax') OR (unit_cost IS NULL AND value = 0));
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_unit_tax
    CHECK (kind <> 'unit_tax' OR (ratio_from = 1 AND ratio_to = 1 AND received < held AND value > 0));

-- +goose Down
CREATE TEMPORARY TABLE unit_tax_transaction ON COMMIT DROP AS
SELECT books_id, transaction_id FROM ledger_corporate_action WHERE kind = 'unit_tax';
DELETE FROM ledger_corporate_action WHERE kind = 'unit_tax';
DELETE FROM ledger_transaction t USING unit_tax_transaction u
WHERE t.books_id = u.books_id AND t.id = u.transaction_id;

ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_unit_tax;
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_value;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_check2
    CHECK (kind = 'bonus' OR (unit_cost IS NULL AND value = 0));
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_kind_check;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_kind_check
    CHECK (kind IN ('split', 'reverse_split', 'bonus'));

DELETE FROM ledger_account WHERE system_role = 'prepaid_tax';
ALTER TABLE ledger_account DROP CONSTRAINT ledger_account_system_role_check;
ALTER TABLE ledger_account ADD CONSTRAINT ledger_account_system_role_check CHECK (system_role IN (
    'opening_balances', 'adjustments', 'uncategorized_expense', 'uncategorized_income', 'yield', 'discounts',
    'interest', 'taxes', 'fees', 'realized_gains', 'realized_losses', 'transfers_in_transit'));

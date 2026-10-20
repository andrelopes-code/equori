-- +goose Up
-- A88: a card payment whose paying account is not known yet books its other side on the
-- system account transfers_in_transit until a pairing replaces it.
ALTER TABLE ledger_account DROP CONSTRAINT ledger_account_system_role_check;
ALTER TABLE ledger_account ADD CONSTRAINT ledger_account_system_role_check CHECK (system_role IN (
    'opening_balances', 'adjustments', 'uncategorized_expense', 'uncategorized_income', 'yield', 'discounts',
    'interest', 'taxes', 'fees', 'realized_gains', 'realized_losses', 'transfers_in_transit'));
INSERT INTO ledger_account (user_id, name, account_class, instrument, opened_on, system_role)
SELECT user_id, 'Transfers in transit', 'equity', base_currency, DATE '1900-01-01', 'transfers_in_transit'
FROM ledger_settings;

-- A88: the line type the ledger applied, so a later sync applies a type it did not.
ALTER TABLE ingestion_external_record ADD COLUMN line_kind text CHECK (line_kind IN ('payment', 'refund'));

-- +goose Down
ALTER TABLE ingestion_external_record DROP COLUMN line_kind;
DELETE FROM ledger_account WHERE system_role = 'transfers_in_transit';
ALTER TABLE ledger_account DROP CONSTRAINT ledger_account_system_role_check;
ALTER TABLE ledger_account ADD CONSTRAINT ledger_account_system_role_check CHECK (system_role IN (
    'opening_balances', 'adjustments', 'uncategorized_expense', 'uncategorized_income', 'yield', 'discounts',
    'interest', 'taxes', 'fees', 'realized_gains', 'realized_losses'));

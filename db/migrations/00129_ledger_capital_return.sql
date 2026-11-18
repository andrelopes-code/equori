-- +goose Up
-- Coverage row E-08: a capital return (an amortization of an FII, a reduction of capital) keeps
-- the units, lowers their cost and pays value, above zero, into the cash account.
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_kind_check;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_kind_check
    CHECK (kind IN (
        'split', 'reverse_split', 'bonus', 'unit_tax', 'conversion', 'spin_off', 'right_issue',
        'right_exercise', 'capital_return'
    ));

ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_value;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_value
    CHECK (kind IN ('bonus', 'unit_tax')
        OR (unit_cost IS NULL
            AND (value > 0) = (kind IN ('right_exercise', 'capital_return'))
            AND value >= 0));

-- +goose Down
CREATE TEMPORARY TABLE capital_return_transaction ON COMMIT DROP AS
SELECT books_id, transaction_id FROM ledger_corporate_action WHERE kind = 'capital_return';
DELETE FROM ledger_corporate_action WHERE kind = 'capital_return';
DELETE FROM ledger_transaction t USING capital_return_transaction r
WHERE t.books_id = r.books_id AND t.id = r.transaction_id;

ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_value;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_value
    CHECK (kind IN ('bonus', 'unit_tax')
        OR (unit_cost IS NULL AND (value > 0) = (kind = 'right_exercise') AND value >= 0));
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_kind_check;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_kind_check
    CHECK (kind IN (
        'split', 'reverse_split', 'bonus', 'unit_tax', 'conversion', 'spin_off', 'right_issue',
        'right_exercise'
    ));

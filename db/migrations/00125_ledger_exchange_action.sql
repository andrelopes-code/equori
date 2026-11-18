-- +goose Up
-- Coverage row E-07 (assistant parity design, phase 6): a conversion (a merger or a ticker change)
-- gives units of another security for the whole holding, and a spin-off gives them beside the
-- holding with cost_bp of its cost. new_account_id is the holding of that security.
ALTER TABLE ledger_corporate_action
    ADD COLUMN new_account_id uuid,
    ADD COLUMN cost_bp integer CHECK (cost_bp BETWEEN 1 AND 9999),
    ADD CONSTRAINT ledger_corporate_action_new_account_fkey
        FOREIGN KEY (books_id, new_account_id) REFERENCES ledger_account (books_id, id);

ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_kind_check;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_kind_check
    CHECK (kind IN ('split', 'reverse_split', 'bonus', 'unit_tax', 'conversion', 'spin_off'));

ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_check1;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_ratio
    CHECK (kind IN ('conversion', 'spin_off') OR (kind = 'reverse_split') = (ratio_to < ratio_from));

ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_exchange
    CHECK ((kind IN ('conversion', 'spin_off')) = (new_account_id IS NOT NULL)
        AND (kind = 'spin_off') = (cost_bp IS NOT NULL));

CREATE INDEX ledger_corporate_action_new_account ON ledger_corporate_action (new_account_id);

-- +goose Down
CREATE TEMPORARY TABLE exchange_transaction ON COMMIT DROP AS
SELECT books_id, transaction_id FROM ledger_corporate_action WHERE kind IN ('conversion', 'spin_off');
DELETE FROM ledger_corporate_action WHERE kind IN ('conversion', 'spin_off');
DELETE FROM ledger_transaction t USING exchange_transaction e
WHERE t.books_id = e.books_id AND t.id = e.transaction_id;

DROP INDEX ledger_corporate_action_new_account;
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_exchange;
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_ratio;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_check1
    CHECK ((kind = 'reverse_split') = (ratio_to < ratio_from));
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_kind_check;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_kind_check
    CHECK (kind IN ('split', 'reverse_split', 'bonus', 'unit_tax'));
ALTER TABLE ledger_corporate_action DROP COLUMN cost_bp, DROP COLUMN new_account_id;

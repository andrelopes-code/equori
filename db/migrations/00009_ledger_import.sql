-- +goose Up
-- P4 amendment A11: the external record a transaction was created from or matched to.
ALTER TABLE ledger_transaction ADD COLUMN external_record_id uuid;
CREATE UNIQUE INDEX ledger_transaction_external_record_idx
    ON ledger_transaction (user_id, external_record_id) WHERE external_record_id IS NOT NULL;

-- +goose Down
DROP INDEX ledger_transaction_external_record_idx;
ALTER TABLE ledger_transaction DROP COLUMN external_record_id;

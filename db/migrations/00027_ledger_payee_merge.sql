-- +goose Up
-- A82: a merged payee is kept, pointing at the payee that replaced it, and leaves the payee list.
ALTER TABLE ledger_payee ADD COLUMN merged_into uuid;
ALTER TABLE ledger_payee ADD CONSTRAINT ledger_payee_merged_into_fkey
    FOREIGN KEY (user_id, merged_into) REFERENCES ledger_payee (user_id, id);
ALTER TABLE ledger_payee ADD CONSTRAINT ledger_payee_merged_into_check CHECK (merged_into <> id);

-- +goose Down
ALTER TABLE ledger_payee DROP CONSTRAINT ledger_payee_merged_into_check;
ALTER TABLE ledger_payee DROP CONSTRAINT ledger_payee_merged_into_fkey;
ALTER TABLE ledger_payee DROP COLUMN merged_into;

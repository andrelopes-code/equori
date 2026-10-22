-- +goose Up
-- ADR 013: the ISPB identifies an institution in the Brazilian payment system and keys its logo.
ALTER TABLE ledger_institution ADD COLUMN ispb text CHECK (ispb ~ '^[0-9]{8}$');
CREATE UNIQUE INDEX ledger_institution_ispb_key ON ledger_institution (user_id, ispb);

-- +goose Down
DROP INDEX ledger_institution_ispb_key;
ALTER TABLE ledger_institution DROP COLUMN ispb;

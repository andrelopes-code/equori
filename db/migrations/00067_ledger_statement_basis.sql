-- +goose Up
-- A136: the source that chose a card posting's statement. Existing postings take 'date':
-- the ledger cannot tell which of them a line's bill placed.
ALTER TABLE ledger_posting
    ADD COLUMN statement_basis text NOT NULL DEFAULT 'date'
    CHECK (statement_basis IN ('date', 'owner', 'institution'));

-- +goose Down
ALTER TABLE ledger_posting DROP COLUMN statement_basis;

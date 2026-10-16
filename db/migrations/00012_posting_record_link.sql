-- +goose Up
-- P5b amendment A27: an external record confirms one posting, on the record's account.
ALTER TABLE ledger_posting ADD COLUMN external_record_id uuid;
CREATE UNIQUE INDEX ledger_posting_external_record_idx
    ON ledger_posting (user_id, external_record_id) WHERE external_record_id IS NOT NULL;

-- One-time move of the links; the only read of an ingestion table by a ledger migration.
UPDATE ledger_posting p
SET external_record_id = t.external_record_id
FROM ledger_transaction t
JOIN ingestion_external_record r ON r.id = t.external_record_id
WHERE p.transaction_id = t.id
  AND p.account_id = r.account_id
  AND p.position = (SELECT min(q.position) FROM ledger_posting q WHERE q.transaction_id = t.id AND q.account_id = r.account_id);

DROP INDEX ledger_transaction_external_record_idx;
ALTER TABLE ledger_transaction DROP COLUMN external_record_id;

-- I07: a transaction holds at most one record per account.
DROP INDEX ingestion_record_transaction_idx;
CREATE UNIQUE INDEX ingestion_record_transaction_idx
    ON ingestion_external_record (user_id, transaction_id, account_id) WHERE transaction_id IS NOT NULL;

-- +goose Down
DROP INDEX ingestion_record_transaction_idx;
CREATE UNIQUE INDEX ingestion_record_transaction_idx ON ingestion_external_record (user_id, transaction_id) WHERE transaction_id IS NOT NULL;
ALTER TABLE ledger_transaction ADD COLUMN external_record_id uuid;
UPDATE ledger_transaction t SET external_record_id = p.external_record_id
FROM ledger_posting p WHERE p.transaction_id = t.id AND p.external_record_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_transaction_external_record_idx
    ON ledger_transaction (user_id, external_record_id) WHERE external_record_id IS NOT NULL;
DROP INDEX ledger_posting_external_record_idx;
ALTER TABLE ledger_posting DROP COLUMN external_record_id;

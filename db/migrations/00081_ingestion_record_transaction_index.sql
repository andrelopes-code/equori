-- +goose Up
-- A172: a confirmed group holds one record per posting of its entry. The posting column and
-- its unique index (ledger_posting_external_record_idx) keep I07; this index only finds the
-- records of a transaction.
DROP INDEX ingestion_record_transaction_idx;
CREATE INDEX ingestion_record_transaction_idx
    ON ingestion_external_record (books_id, transaction_id, account_id)
    WHERE transaction_id IS NOT NULL AND installment_number IS NULL;

-- +goose Down
DROP INDEX ingestion_record_transaction_idx;
CREATE UNIQUE INDEX ingestion_record_transaction_idx
    ON ingestion_external_record (books_id, transaction_id, account_id)
    WHERE transaction_id IS NOT NULL AND installment_number IS NULL;

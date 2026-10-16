-- +goose Up
-- P6 amendment A40: the ledger plan an aggregator's installment lines belong to, by card,
-- purchase date, installment count and normalized description.
CREATE TABLE ingestion_installment_plan (
    user_id    bigint NOT NULL,
    account_id uuid   NOT NULL,
    plan_key   bytea  NOT NULL CHECK (length(plan_key) = 32),
    plan_id    uuid   NOT NULL,
    PRIMARY KEY (user_id, plan_key),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, plan_id) REFERENCES ledger_installment_plan (user_id, id) ON DELETE CASCADE
);

-- I07 (P5b A27): one record per account of a transaction, except installment lines, which
-- confirm one installment posting each; ledger_posting_external_record_idx keeps one record
-- per posting.
DROP INDEX ingestion_record_transaction_idx;
CREATE UNIQUE INDEX ingestion_record_transaction_idx
    ON ingestion_external_record (user_id, transaction_id, account_id)
    WHERE transaction_id IS NOT NULL AND installment_number IS NULL;

-- +goose Down
DROP INDEX ingestion_record_transaction_idx;
CREATE UNIQUE INDEX ingestion_record_transaction_idx
    ON ingestion_external_record (user_id, transaction_id, account_id) WHERE transaction_id IS NOT NULL;
DROP TABLE ingestion_installment_plan;

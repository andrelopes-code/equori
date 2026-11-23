-- +goose Up
-- A264: a yield line that neither a reserve nor the account's balance explains.
ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group', 'reserve', 'duplicate', 'transfer', 'reconciled', 'yield'));

-- +goose Down
UPDATE ingestion_external_record
SET review_reason = NULL
WHERE review_reason = 'yield';

ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group', 'reserve', 'duplicate', 'transfer', 'reconciled'));

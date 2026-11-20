-- +goose Up
-- A261: a first-reported sync line dated before the account's last reconciled balance.
ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group', 'reserve', 'duplicate', 'transfer', 'reconciled'));

-- +goose Down
UPDATE ingestion_external_record
SET review_reason = NULL
WHERE review_reason = 'reconciled';

ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group', 'reserve', 'duplicate', 'transfer'));

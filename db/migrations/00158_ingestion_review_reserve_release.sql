-- +goose Up
-- A268: a release line that no withdrawal line or no reported balance confirms.
ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group', 'reserve', 'duplicate', 'transfer', 'reconciled', 'yield', 'reserve_release'));

-- +goose Down
UPDATE ingestion_external_record
SET review_reason = NULL
WHERE review_reason = 'reserve_release';

ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group', 'reserve', 'duplicate', 'transfer', 'reconciled', 'yield'));

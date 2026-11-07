-- +goose Up
-- A212: when the current name of an external account began. A214: when a listing first lacked it.
ALTER TABLE ingestion_external_account
    ADD COLUMN name_from date,
    ADD COLUMN name_on date,
    ADD COLUMN gone_since date;

-- A213, A215: a reserve line no candidate resolves, a line that may repeat a stored one.
ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group', 'reserve', 'duplicate'));

-- +goose Down
UPDATE ingestion_external_record
SET review_reason = 'ambiguous'
WHERE review_reason IN ('reserve', 'duplicate');

ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group'));

ALTER TABLE ingestion_external_account
    DROP COLUMN gone_since,
    DROP COLUMN name_on,
    DROP COLUMN name_from;

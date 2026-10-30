-- +goose Up
-- A142: a card credit that repeats a recorded payment waits for review.
ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated'));

-- +goose Down
ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed'));

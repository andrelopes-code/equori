-- +goose Up
-- A100, A101: why a record waits for review, and its candidates as matching scored them.
ALTER TABLE ingestion_external_record
    ADD COLUMN review_reason text CHECK (review_reason IN ('ambiguous', 'probable', 'changed')),
    ADD COLUMN candidate_scores jsonb NOT NULL DEFAULT '[]';

-- +goose Down
ALTER TABLE ingestion_external_record DROP COLUMN candidate_scores, DROP COLUMN review_reason;

-- +goose Up
ALTER TABLE ingestion_csv_profile
    ADD COLUMN encoding text NOT NULL DEFAULT 'auto' CHECK (encoding ~ '^[a-z0-9_-]{2,40}$');

-- +goose Down
ALTER TABLE ingestion_csv_profile DROP COLUMN encoding;

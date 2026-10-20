-- +goose Up
-- A94: the names an external account carried before the institution renamed it; a reserve
-- line may still name the reserve by one of them.
ALTER TABLE ingestion_external_account ADD COLUMN former_names text[] NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE ingestion_external_account DROP COLUMN former_names;

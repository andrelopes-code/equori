-- +goose Up
ALTER TABLE ingestion_connection RENAME COLUMN external_item_id TO external_id;

-- +goose Down
ALTER TABLE ingestion_connection RENAME COLUMN external_id TO external_item_id;

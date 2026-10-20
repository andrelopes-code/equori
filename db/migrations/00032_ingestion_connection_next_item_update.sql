-- +goose Up
-- A95: when the provider will next update the item, as the last check read it.
ALTER TABLE ingestion_connection ADD COLUMN next_item_update_at timestamptz;

-- +goose Down
ALTER TABLE ingestion_connection DROP COLUMN next_item_update_at;

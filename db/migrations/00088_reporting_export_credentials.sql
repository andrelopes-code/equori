-- +goose Up
-- Export design C2: the integration credentials of a pending export, sealed by the owner's passphrase.
-- The build copies them into the archive and clears the column.
ALTER TABLE reporting_export ADD COLUMN credentials bytea;

-- +goose Down
ALTER TABLE reporting_export DROP COLUMN credentials;

-- +goose Up
-- ADR 021: the archive_version of a ready export; an export built before this column holds version 1.
ALTER TABLE reporting_export ADD COLUMN archive_version integer;
UPDATE reporting_export SET archive_version = 1 WHERE status = 'ready';

-- +goose Down
ALTER TABLE reporting_export DROP COLUMN archive_version;

-- name: GetSyncInterval :one
SELECT
    sync_interval_minutes
FROM
    ingestion_instance_settings;

-- name: SetSyncInterval :exec
INSERT INTO
    ingestion_instance_settings (sync_interval_minutes)
VALUES
    ($1)
ON CONFLICT (id) DO UPDATE
SET
    sync_interval_minutes = EXCLUDED.sync_interval_minutes;

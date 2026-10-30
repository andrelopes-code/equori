-- +goose Up
-- ADR 029 BK23: the sync interval belongs to the instance; at most one row, no row means 60 minutes.
CREATE TABLE ingestion_instance_settings (
    id                    boolean PRIMARY KEY DEFAULT true CHECK (id),
    sync_interval_minutes integer NOT NULL CHECK (sync_interval_minutes BETWEEN 1 AND 1440)
);

-- +goose Down
DROP TABLE ingestion_instance_settings;

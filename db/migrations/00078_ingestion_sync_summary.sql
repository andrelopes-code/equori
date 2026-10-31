-- +goose Up
-- P12 A149: the batches of one sync run of a connection share its id.
ALTER TABLE ingestion_batch
    ADD COLUMN sync_id uuid,
    ADD CONSTRAINT ingestion_batch_sync_check CHECK (sync_id IS NULL OR source = 'aggregator');

CREATE INDEX ingestion_batch_sync_idx ON ingestion_batch (books_id, sync_id) WHERE sync_id IS NOT NULL;

-- A148: the record's last automatic decision and what its undo restores; kept: the owner
-- undid its withdrawal. A149: the batch of the sync run whose summary lists the record.
ALTER TABLE ingestion_external_record
    ADD COLUMN decision         text    CHECK (decision IN ('linked', 'followed', 'withdrawn', 're_identified')),
    ADD COLUMN decision_undo    jsonb   NOT NULL DEFAULT '{}',
    ADD COLUMN summary_batch_id uuid,
    ADD COLUMN kept             boolean NOT NULL DEFAULT false,
    ADD FOREIGN KEY (books_id, summary_batch_id) REFERENCES ingestion_batch (books_id, id) ON DELETE SET NULL (summary_batch_id);

CREATE INDEX ingestion_record_summary_idx ON ingestion_external_record (summary_batch_id) WHERE summary_batch_id IS NOT NULL;

-- +goose Down
DROP INDEX ingestion_record_summary_idx;
ALTER TABLE ingestion_external_record
    DROP COLUMN kept,
    DROP COLUMN summary_batch_id,
    DROP COLUMN decision_undo,
    DROP COLUMN decision;
DROP INDEX ingestion_batch_sync_idx;
ALTER TABLE ingestion_batch DROP CONSTRAINT ingestion_batch_sync_check, DROP COLUMN sync_id;

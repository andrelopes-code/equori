-- +goose Up
-- P12 A143: the institution's own id of a line, when the aggregator relays it.
-- A147: the institution's last report of a line's amount and date.
ALTER TABLE ingestion_external_record
    ADD COLUMN institution_id  text CHECK (institution_id <> ''),
    ADD COLUMN reported_amount bigint,
    ADD COLUMN reported_on     date;

UPDATE ingestion_external_record
SET
    reported_amount = amount,
    reported_on = booked_on;

ALTER TABLE ingestion_external_record
    ALTER COLUMN reported_amount SET NOT NULL,
    ALTER COLUMN reported_on SET NOT NULL;

CREATE INDEX ingestion_external_record_institution_idx
    ON ingestion_external_record (books_id, account_id, institution_id)
    WHERE institution_id IS NOT NULL;

-- A144, A153: the start of an account's last read and the date of its last deep read.
ALTER TABLE ingestion_external_account
    ADD COLUMN last_read_at      timestamptz,
    ADD COLUMN last_deep_read_on date;

-- A151: the consent expiry the aggregator reports.
ALTER TABLE ingestion_connection ADD COLUMN consent_expires_at timestamptz;

-- A143, A146: re-identified lines, and a date read that returned no line.
ALTER TABLE ingestion_batch
    ADD COLUMN re_identified integer NOT NULL DEFAULT 0,
    ADD COLUMN read_empty    boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE ingestion_batch DROP COLUMN read_empty, DROP COLUMN re_identified;
ALTER TABLE ingestion_connection DROP COLUMN consent_expires_at;
ALTER TABLE ingestion_external_account DROP COLUMN last_deep_read_on, DROP COLUMN last_read_at;
DROP INDEX ingestion_external_record_institution_idx;
ALTER TABLE ingestion_external_record
    DROP COLUMN reported_on,
    DROP COLUMN reported_amount,
    DROP COLUMN institution_id;

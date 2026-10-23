-- +goose Up
-- The dedup key of a line with an external id is sha256(account || 0 || source || 0 || "id" || 0 || external id).
-- Migration 48 renamed the source open_finance to aggregator without rehashing the stored keys.
-- A stored key that collides with the key of a line imported again after that rename makes this
-- statement fail on UNIQUE (user_id, dedup_key); the duplicate line must be removed first.
UPDATE ingestion_external_record r
SET dedup_key = sha256(
    convert_to(r.account_id::text, 'UTF8') || '\x00'::bytea || convert_to('aggregator', 'UTF8') || '\x00'::bytea
    || convert_to('id', 'UTF8') || '\x00'::bytea || convert_to(r.external_id, 'UTF8'))
FROM ingestion_batch b
WHERE b.id = r.batch_id AND b.user_id = r.user_id AND b.source = 'aggregator'
  AND r.external_id IS NOT NULL
  AND r.dedup_key = sha256(
    convert_to(r.account_id::text, 'UTF8') || '\x00'::bytea || convert_to('open_finance', 'UTF8') || '\x00'::bytea
    || convert_to('id', 'UTF8') || '\x00'::bytea || convert_to(r.external_id, 'UTF8'));

-- +goose Down
UPDATE ingestion_external_record r
SET dedup_key = sha256(
    convert_to(r.account_id::text, 'UTF8') || '\x00'::bytea || convert_to('open_finance', 'UTF8') || '\x00'::bytea
    || convert_to('id', 'UTF8') || '\x00'::bytea || convert_to(r.external_id, 'UTF8'))
FROM ingestion_batch b
WHERE b.id = r.batch_id AND b.user_id = r.user_id AND b.source = 'aggregator'
  AND r.external_id IS NOT NULL
  AND r.dedup_key = sha256(
    convert_to(r.account_id::text, 'UTF8') || '\x00'::bytea || convert_to('aggregator', 'UTF8') || '\x00'::bytea
    || convert_to('id', 'UTF8') || '\x00'::bytea || convert_to(r.external_id, 'UTF8'));

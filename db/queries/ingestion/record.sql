-- name: InsertRecord :one
INSERT INTO ingestion_external_record (user_id, batch_id, account_id, external_id, dedup_key, raw, booked_on, amount, description)
VALUES (@user_id, @batch_id, @account_id, sqlc.narg(external_id), @dedup_key, @raw, @booked_on, @amount, @description)
ON CONFLICT (user_id, dedup_key) DO NOTHING
RETURNING *;

-- name: GetRecordByKey :one
SELECT * FROM ingestion_external_record WHERE user_id = $1 AND dedup_key = $2;

-- name: SaveRecordOutcome :exec
UPDATE ingestion_external_record
SET batch_id = @batch_id, state = @state, transaction_id = sqlc.narg(transaction_id), candidates = @candidates
WHERE user_id = @user_id AND id = @id;

-- name: GetRecord :one
SELECT * FROM ingestion_external_record WHERE user_id = $1 AND id = $2;

-- name: ListBatchRecords :many
SELECT * FROM ingestion_external_record
WHERE user_id = @user_id AND batch_id = @batch_id
  AND (sqlc.narg(state)::text IS NULL OR state = sqlc.narg(state)::text)
  AND (sqlc.narg(after_id)::uuid IS NULL OR id > sqlc.narg(after_id)::uuid)
ORDER BY id
LIMIT @row_limit;

-- name: MoveReviewCount :exec
-- A resolved record leaves needs_review for the state the owner chose.
UPDATE ingestion_batch SET
    needs_review = needs_review - 1,
    matched = matched + (@state::text = 'matched')::int,
    created = created + (@state::text = 'created')::int,
    discarded = discarded + (@state::text = 'discarded')::int
WHERE user_id = @user_id AND id = @id;

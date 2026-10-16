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

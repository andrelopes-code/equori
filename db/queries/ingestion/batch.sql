-- name: ListBatches :many
SELECT * FROM ingestion_batch
WHERE user_id = @user_id
  AND (sqlc.narg(after_started)::timestamptz IS NULL OR (started_at, id) < (sqlc.narg(after_started)::timestamptz, sqlc.narg(after_id)::uuid))
ORDER BY started_at DESC, id DESC
LIMIT @row_limit;

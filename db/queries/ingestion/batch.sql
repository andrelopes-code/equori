-- name: ListBatches :many
SELECT * FROM ingestion_batch
WHERE user_id = @user_id
  AND (sqlc.narg(after_started)::timestamptz IS NULL OR (started_at, id) < (sqlc.narg(after_started)::timestamptz, sqlc.narg(after_id)::uuid))
ORDER BY started_at DESC, id DESC
LIMIT @row_limit;

-- name: InsertBatch :one
INSERT INTO ingestion_batch (user_id, account_id, source, file_name, currency, period_from, period_to, external_account_id)
VALUES (@user_id, @account_id, @source, sqlc.narg(file_name), @currency, sqlc.narg(period_from), sqlc.narg(period_to), sqlc.narg(external_account_id))
RETURNING *;

-- name: CompleteBatch :one
UPDATE ingestion_batch SET
    received = @received, ignored = @ignored, matched = @matched, created = @created,
    needs_review = @needs_review, discarded = @discarded, updated = @updated, withdrawn = @withdrawn,
    balance_date = sqlc.narg(balance_date), balance_amount = sqlc.narg(balance_amount),
    balance_status = @balance_status, balance_reason = sqlc.narg(balance_reason), completed_at = now()
WHERE user_id = @user_id AND id = @id
RETURNING *;

-- name: GetBatch :one
SELECT * FROM ingestion_batch WHERE user_id = $1 AND id = $2;

-- name: LockAccountImports :exec
-- Session-level lock held for one import: imports of one account run one at a time.
SELECT pg_advisory_lock(hashtextextended(sqlc.arg(account_key)::text, 0));

-- name: UnlockAccountImports :exec
SELECT pg_advisory_unlock(hashtextextended(sqlc.arg(account_key)::text, 0));

-- name: InsertRecords :batchone
-- A row comes back only for a new key; a conflict is pgx.ErrNoRows for that item.
INSERT INTO ingestion_external_record (user_id, batch_id, account_id, external_id, dedup_key, raw, booked_on, amount, description,
    external_status, due_date, installment_number, installment_count, category_id, balance_after, line_kind)
VALUES (@user_id, @batch_id, @account_id, sqlc.narg(external_id), @dedup_key, @raw, @booked_on, @amount, @description,
    sqlc.narg(external_status), sqlc.narg(due_date), sqlc.narg(installment_number), sqlc.narg(installment_count),
    sqlc.narg(category_id), sqlc.narg(balance_after), sqlc.narg(line_kind))
ON CONFLICT (user_id, dedup_key) DO NOTHING
RETURNING *;

-- name: ListRecordsByKeys :many
SELECT * FROM ingestion_external_record WHERE user_id = @user_id AND dedup_key = ANY(@keys::bytea[]);

-- name: SaveRecordOutcomes :batchexec
UPDATE ingestion_external_record
SET batch_id = @batch_id, state = @state, transaction_id = sqlc.narg(transaction_id), candidates = @candidates,
    review_reason = sqlc.narg(review_reason), candidate_scores = @candidate_scores
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

-- name: MoveRecords :exec
-- P5b amendment A32: records follow the transaction that kept them after a pairing.
UPDATE ingestion_external_record SET transaction_id = @transaction_id
WHERE user_id = @user_id AND id = ANY(@record_ids::uuid[]) AND transaction_id IS NOT NULL;

-- name: UpdateRecordFacts :batchexec
-- P6 A36: the aggregator changed a stored line.
UPDATE ingestion_external_record SET
    raw = @raw, external_status = sqlc.narg(external_status), due_date = sqlc.narg(due_date),
    installment_number = sqlc.narg(installment_number), installment_count = sqlc.narg(installment_count),
    category_id = sqlc.narg(category_id), balance_after = sqlc.narg(balance_after),
    line_kind = sqlc.narg(line_kind), unapplied_change = sqlc.narg(unapplied_change),
    booked_on = @booked_on, amount = @amount, review_reason = sqlc.narg(review_reason)
WHERE user_id = @user_id AND id = @id;

-- name: ListSyncedRecords :many
-- The aggregator lines of an account booked in a window that a sync may find withdrawn (A38).
SELECT * FROM ingestion_external_record
WHERE user_id = @user_id AND account_id = @account_id AND external_status IS NOT NULL
  AND booked_on BETWEEN @from_date::date AND @to_date::date
  AND state NOT IN ('withdrawn', 'discarded');

-- name: WithdrawReviewCounts :exec
UPDATE ingestion_batch b SET needs_review = b.needs_review - w.n
FROM (SELECT batch_id, count(*)::int AS n FROM ingestion_external_record
      WHERE user_id = @user_id AND id = ANY(@record_ids::uuid[]) AND state = 'needs_review' GROUP BY batch_id) w
WHERE b.user_id = @user_id AND b.id = w.batch_id;

-- name: WithdrawRecords :exec
UPDATE ingestion_external_record SET state = 'withdrawn', transaction_id = NULL, candidates = '{}'
WHERE user_id = @user_id AND id = ANY(@record_ids::uuid[]);

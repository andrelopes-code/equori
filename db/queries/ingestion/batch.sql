-- name: ListBatches :many
SELECT
    *
FROM
    ingestion_batch
WHERE
    books_id = @books_id
    AND (
        sqlc.narg (after_started)::timestamptz IS NULL
        OR (started_at, id) < (sqlc.narg (after_started)::timestamptz, sqlc.narg (after_id)::uuid)
    )
ORDER BY
    started_at DESC,
    id DESC
LIMIT
    @row_limit;

-- name: InsertBatch :one
INSERT INTO
    ingestion_batch (
        books_id,
        account_id,
        source,
        file_name,
        currency,
        period_from,
        period_to,
        external_account_id,
        sync_id
    )
VALUES
    (
        @books_id,
        @account_id,
        @source,
        sqlc.narg (file_name),
        @currency,
        sqlc.narg (period_from),
        sqlc.narg (period_to),
        sqlc.narg (external_account_id),
        sqlc.narg (sync_id)
    )
RETURNING
    *;

-- name: CompleteBatch :one
UPDATE ingestion_batch
SET
    received = @received,
    ignored = @ignored,
    matched = @matched,
    created = @created,
    needs_review = @needs_review,
    discarded = @discarded,
    updated = @updated,
    withdrawn = @withdrawn,
    re_identified = @re_identified,
    read_empty = @read_empty,
    balance_date = sqlc.narg (balance_date),
    balance_amount = sqlc.narg (balance_amount),
    balance_status = @balance_status,
    balance_reason = sqlc.narg (balance_reason),
    completed_at = now()
WHERE
    books_id = @books_id
    AND id = @id
RETURNING
    *;

-- name: GetBatch :one
SELECT
    *
FROM
    ingestion_batch
WHERE
    books_id = $1
    AND id = $2;

-- name: LockAccountImports :exec
-- Session-level lock held for one import: imports of one account run one at a time.
SELECT
    pg_advisory_lock(hashtextextended (sqlc.arg (account_key)::text, 0));

-- name: UnlockAccountImports :exec
SELECT
    pg_advisory_unlock(hashtextextended (sqlc.arg (account_key)::text, 0));

-- name: ListConnectionSyncs :many
-- A149: the newest sync runs of a connection whose summary lists a record.
SELECT
    b.sync_id::uuid AS sync_id,
    min(b.started_at)::timestamptz AS started_at
FROM
    ingestion_batch b
    JOIN ingestion_external_account a ON a.books_id = b.books_id
    AND a.id = b.external_account_id
WHERE
    b.books_id = @books_id
    AND a.connection_id = @connection_id
    AND b.sync_id IS NOT NULL
    AND EXISTS (
        SELECT
            1
        FROM
            ingestion_external_record r
        WHERE
            r.books_id = b.books_id
            AND r.summary_batch_id = b.id
    )
GROUP BY
    b.sync_id
ORDER BY
    started_at DESC
LIMIT
    @row_limit;

-- name: ListSyncBatches :many
-- A149: every batch of the given sync runs.
SELECT
    *
FROM
    ingestion_batch
WHERE
    books_id = @books_id
    AND sync_id = ANY (@sync_ids::UUID[])
ORDER BY
    started_at,
    id;

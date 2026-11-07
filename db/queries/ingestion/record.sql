-- name: InsertRecords :batchone
-- A row comes back only for a new key; a conflict is pgx.ErrNoRows for that item.
INSERT INTO
    ingestion_external_record (
        books_id,
        batch_id,
        account_id,
        external_id,
        dedup_key,
        raw,
        booked_on,
        amount,
        description,
        external_status,
        due_date,
        installment_number,
        installment_count,
        category_id,
        balance_after,
        line_kind,
        institution_id,
        reported_amount,
        reported_on
    )
VALUES
    (
        @books_id,
        @batch_id,
        @account_id,
        sqlc.narg (external_id),
        @dedup_key,
        @raw,
        @booked_on,
        @amount,
        @description,
        sqlc.narg (external_status),
        sqlc.narg (due_date),
        sqlc.narg (installment_number),
        sqlc.narg (installment_count),
        sqlc.narg (category_id),
        sqlc.narg (balance_after),
        sqlc.narg (line_kind),
        sqlc.narg (institution_id),
        @reported_amount,
        @reported_on
    )
ON CONFLICT (books_id, dedup_key) DO NOTHING
RETURNING
    *;

-- name: ListRecordsByKeys :many
SELECT
    *
FROM
    ingestion_external_record
WHERE
    books_id = @books_id
    AND dedup_key = ANY (@keys::bytea[]);

-- name: SaveRecordOutcomes :batchexec
UPDATE ingestion_external_record
SET
    batch_id = @batch_id,
    state = @state,
    transaction_id = sqlc.narg (transaction_id),
    candidates = @candidates,
    review_reason = sqlc.narg (review_reason),
    candidate_scores = @candidate_scores,
    decision = sqlc.narg (decision),
    decision_undo = @decision_undo,
    summary_batch_id = sqlc.narg (summary_batch_id)
WHERE
    books_id = @books_id
    AND id = @id;

-- name: GetRecord :one
SELECT
    *
FROM
    ingestion_external_record
WHERE
    books_id = $1
    AND id = $2;

-- name: ListBatchRecords :many
SELECT
    *
FROM
    ingestion_external_record
WHERE
    books_id = @books_id
    AND batch_id = @batch_id
    AND (
        sqlc.narg (state)::text IS NULL
        OR state = sqlc.narg (state)::text
    )
    AND (
        sqlc.narg (after_id)::uuid IS NULL
        OR id > sqlc.narg (after_id)::uuid
    )
ORDER BY
    id
LIMIT
    @row_limit;

-- name: MoveReviewCount :exec
-- A resolved record leaves needs_review for the state the owner chose.
UPDATE ingestion_batch
SET
    needs_review = needs_review - 1,
    matched = matched + (@state::text = 'matched')::int,
    created = created + (@state::text = 'created')::int,
    discarded = discarded + (@state::text = 'discarded')::int
WHERE
    books_id = @books_id
    AND id = @id;

-- name: ReopenRecord :execrows
-- A140: a discarded record returns to review.
UPDATE ingestion_external_record
SET
    state = 'needs_review'
WHERE
    books_id = @books_id
    AND id = @id
    AND state = 'discarded';

-- name: MoveReopenedCount :exec
UPDATE ingestion_batch
SET
    discarded = discarded - 1,
    needs_review = needs_review + 1
WHERE
    books_id = @books_id
    AND id = @id;

-- name: MoveRecords :exec
-- P5b amendment A32: records follow the transaction that kept them after a pairing.
UPDATE ingestion_external_record
SET
    transaction_id = @transaction_id
WHERE
    books_id = @books_id
    AND id = ANY (@record_ids::UUID[])
    AND transaction_id IS NOT NULL;

-- name: UpdateRecordFacts :batchexec
-- P6 A36: the aggregator changed a stored line.
UPDATE ingestion_external_record
SET
    raw = @raw,
    external_status = sqlc.narg (external_status),
    due_date = sqlc.narg (due_date),
    installment_number = sqlc.narg (installment_number),
    installment_count = sqlc.narg (installment_count),
    category_id = sqlc.narg (category_id),
    balance_after = sqlc.narg (balance_after),
    line_kind = sqlc.narg (line_kind),
    unapplied_change = sqlc.narg (unapplied_change),
    booked_on = @booked_on,
    amount = @amount,
    review_reason = sqlc.narg (review_reason),
    institution_id = coalesce(institution_id, sqlc.narg (institution_id)),
    reported_amount = @reported_amount,
    reported_on = @reported_on,
    decision = sqlc.narg (decision),
    decision_undo = @decision_undo,
    summary_batch_id = sqlc.narg (summary_batch_id)
WHERE
    books_id = @books_id
    AND id = @id;

-- name: ListSyncedRecords :many
-- The aggregator lines of an account booked in a window that a sync may find withdrawn (A38).
SELECT
    *
FROM
    ingestion_external_record
WHERE
    books_id = @books_id
    AND account_id = @account_id
    AND external_status IS NOT NULL
    AND booked_on BETWEEN @from_date::date AND @to_date::date
    AND state NOT IN ('withdrawn', 'discarded');

-- name: WithdrawReviewCounts :exec
UPDATE ingestion_batch b
SET
    needs_review = b.needs_review - w.n
FROM
    (
        SELECT
            batch_id,
            count(*)::int AS n
        FROM
            ingestion_external_record
        WHERE
            books_id = @books_id
            AND id = ANY (@record_ids::UUID[])
            AND state = 'needs_review'
        GROUP BY
            batch_id
    ) w
WHERE
    b.books_id = @books_id
    AND b.id = w.batch_id;

-- name: WithdrawRecords :exec
-- A38, A148: the decision keeps what the record was, for its undo.
UPDATE ingestion_external_record
SET
    state = 'withdrawn',
    transaction_id = NULL,
    candidates = '{}',
    decision = 'withdrawn',
    decision_undo = jsonb_strip_nulls(
        jsonb_build_object(
            'state',
            state,
            'transaction_id',
            transaction_id,
            'review_reason',
            review_reason
        )
    ),
    summary_batch_id = @batch_id::uuid
WHERE
    books_id = @books_id
    AND id = ANY (@record_ids::UUID[]);

-- name: ListRecordsByLineIDs :many
-- A143: the account's aggregator records that hold an external id or an institution line id of a read.
SELECT
    *
FROM
    ingestion_external_record
WHERE
    books_id = @books_id
    AND account_id = @account_id
    AND external_status IS NOT NULL
    AND (
        external_id = ANY (@external_ids::TEXT[])
        OR institution_id = ANY (@institution_ids::TEXT[])
    );

-- name: ListCreatedRecords :many
-- A167: the lines the import created in a window; a group may take them over.
SELECT
    *
FROM
    ingestion_external_record
WHERE
    books_id = @books_id
    AND account_id = @account_id
    AND state = 'created'
    AND booked_on BETWEEN @from_date::date AND @to_date::date
ORDER BY
    booked_on,
    id;

-- name: ListRepeatableRecords :many
-- A215: the stored lines a new line may repeat; files_only leaves out aggregator lines, which a
-- sync withdraws when the aggregator stops returning them (A38).
SELECT
    *
FROM
    ingestion_external_record
WHERE
    books_id = @books_id
    AND account_id = @account_id
    AND state IN ('created', 'matched')
    AND booked_on BETWEEN @from_date::date AND @to_date::date
    AND (
        NOT @files_only::boolean
        OR external_status IS NULL
    )
ORDER BY
    booked_on,
    id;

-- name: ListGroupRecords :many
-- A168: the lines in review that wait with the entry as their candidate.
SELECT
    *
FROM
    ingestion_external_record
WHERE
    books_id = @books_id
    AND account_id = @account_id
    AND state = 'needs_review'
    AND review_reason = 'group'
    AND @entry::uuid = ANY (candidates)
ORDER BY
    booked_on,
    id;

-- name: ReidentifyRecord :exec
-- A143: the record takes the external id, deduplication key and raw payload of its line;
-- A148: the decision keeps the previous ones, for its undo.
UPDATE ingestion_external_record
SET
    external_id = @external_id,
    dedup_key = @dedup_key,
    raw = @raw,
    decision = 're_identified',
    decision_undo = jsonb_build_object(
        'external_id',
        external_id,
        'dedup_key',
        encode(dedup_key, 'base64'),
        'raw',
        raw
    ),
    summary_batch_id = @batch_id::uuid
WHERE
    books_id = @books_id
    AND id = @id;

-- name: UndoRecordDecision :execrows
-- A148: a record after the undo of its decision; no row when the decision changed meanwhile.
UPDATE ingestion_external_record
SET
    external_id = sqlc.narg (external_id),
    dedup_key = @dedup_key,
    raw = @raw,
    booked_on = @booked_on,
    amount = @amount,
    state = @state,
    transaction_id = sqlc.narg (transaction_id),
    candidates = @candidates,
    candidate_scores = @candidate_scores,
    review_reason = sqlc.narg (review_reason),
    unapplied_change = sqlc.narg (unapplied_change),
    kept = @kept,
    decision = NULL,
    decision_undo = '{}'
WHERE
    books_id = @books_id
    AND id = @id
    AND decision = @decision::text;

-- name: MoveUndoneCount :exec
-- A148: an undone record enters review in its batch and leaves the count of its state.
UPDATE ingestion_batch
SET
    needs_review = needs_review + 1,
    matched = matched - (@left_state::text = 'matched')::int,
    created = created - (@left_state::text = 'created')::int
WHERE
    books_id = @books_id
    AND id = @id;

-- name: ListSummaryRecords :many
-- A149: the records the summaries of the given batches list.
SELECT
    *
FROM
    ingestion_external_record
WHERE
    books_id = @books_id
    AND summary_batch_id = ANY (@batch_ids::UUID[])
ORDER BY
    booked_on,
    id;

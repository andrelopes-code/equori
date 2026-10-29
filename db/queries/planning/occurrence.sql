-- name: SchedulesTouching :many
-- Schedules whose template names one of the accounts of a transaction (P7 amendment A51).
SELECT
    *
FROM
    planning_schedule
WHERE
    user_id = @user_id
    AND (
        account_id = ANY (@account_ids::UUID[])
        OR counterpart_id = ANY (@account_ids::UUID[])
    )
ORDER BY
    id;

-- name: OccurrenceByTransaction :one
SELECT
    *
FROM
    planning_occurrence
WHERE
    user_id = @user_id
    AND transaction_id = @transaction_id
FOR UPDATE;

-- name: ExpectedOccurrences :many
SELECT
    *
FROM
    planning_occurrence
WHERE
    user_id = @user_id
    AND schedule_id = ANY (@schedule_ids::UUID[])
    AND state = 'expected'
    AND expected_on BETWEEN @from_date AND @to_date
ORDER BY
    expected_on,
    schedule_id,
    sequence
FOR UPDATE;

-- name: LockOccurrence :one
SELECT
    *
FROM
    planning_occurrence
WHERE
    user_id = @user_id
    AND id = @id
FOR UPDATE;

-- name: RealizeOccurrence :one
UPDATE planning_occurrence
SET
    state = 'realized',
    transaction_id = @transaction_id,
    realized_by = @realized_by
WHERE
    user_id = @user_id
    AND id = @id
    AND state = 'expected'
RETURNING
    *;

-- name: ReleaseOccurrence :one
UPDATE planning_occurrence
SET
    state = 'expected',
    transaction_id = NULL,
    realized_by = NULL,
    declined_transaction_id = CASE
        WHEN @decline::boolean THEN transaction_id
        ELSE declined_transaction_id
    END
WHERE
    user_id = @user_id
    AND id = @id
    AND state = 'realized'
RETURNING
    *;

-- name: SkipOccurrence :one
UPDATE planning_occurrence
SET
    state = 'skipped',
    skip_reason = sqlc.narg (skip_reason)
WHERE
    user_id = @user_id
    AND id = @id
    AND state = 'expected'
RETURNING
    *;

-- name: MoveOccurrence :one
-- moved_from keeps the generated date across several moves (P7 amendment A52).
UPDATE planning_occurrence
SET
    moved_from = coalesce(moved_from, expected_on),
    expected_on = @expected_on
WHERE
    user_id = @user_id
    AND id = @id
    AND state = 'expected'
RETURNING
    *;

-- name: DeleteExpected :many
-- Removes the expected occurrences with expected date in [from, to]; moved ones only when
-- include_moved is set. Returns the dates removed.
DELETE FROM planning_occurrence
WHERE
    user_id = @user_id
    AND schedule_id = @schedule_id
    AND state = 'expected'
    AND expected_on BETWEEN @from_date AND @to_date
    AND (
        @include_moved::boolean
        OR moved_from IS NULL
    )
RETURNING
    expected_on;

-- name: KeptOccurrences :many
-- Occurrences a terms change keeps from a date on: realized, skipped or moved (A52).
SELECT
    *
FROM
    planning_occurrence
WHERE
    user_id = @user_id
    AND schedule_id = @schedule_id
    AND coalesce(moved_from, expected_on) >= @from_date
    AND (
        state <> 'expected'
        OR moved_from IS NOT NULL
    )
ORDER BY
    sequence;

-- name: SchedulesTouching :many
-- Schedules whose template names one of the accounts of a transaction (P7 amendment A51).
SELECT * FROM planning_schedule
WHERE user_id = @user_id AND (account_id = ANY(@account_ids::uuid[]) OR counterpart_id = ANY(@account_ids::uuid[]))
ORDER BY id;

-- name: OccurrenceByTransaction :one
SELECT * FROM planning_occurrence WHERE user_id = @user_id AND transaction_id = @transaction_id FOR UPDATE;

-- name: ExpectedOccurrences :many
SELECT * FROM planning_occurrence
WHERE user_id = @user_id AND schedule_id = ANY(@schedule_ids::uuid[]) AND state = 'expected'
  AND expected_on BETWEEN @from_date AND @to_date
ORDER BY expected_on, schedule_id, sequence
FOR UPDATE;

-- name: LockOccurrence :one
SELECT * FROM planning_occurrence WHERE user_id = @user_id AND id = @id FOR UPDATE;

-- name: RealizeOccurrence :one
UPDATE planning_occurrence SET state = 'realized', transaction_id = @transaction_id, realized_by = @realized_by
WHERE user_id = @user_id AND id = @id AND state = 'expected'
RETURNING *;

-- name: ReleaseOccurrence :one
UPDATE planning_occurrence SET state = 'expected', transaction_id = NULL, realized_by = NULL
WHERE user_id = @user_id AND id = @id AND state = 'realized'
RETURNING *;

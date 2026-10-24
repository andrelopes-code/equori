-- name: InsertSchedule :one
INSERT INTO planning_schedule (user_id, kind, account_id, counterpart_id, payee_id, description, currency, match_tolerance_bp, grace_days, generated_until, calendar)
VALUES (@user_id, @kind, @account_id, @counterpart_id, sqlc.narg(payee_id), @description, @currency, @match_tolerance_bp, @grace_days, @generated_until, @calendar)
RETURNING *;

-- name: InsertTerms :exec
INSERT INTO planning_schedule_terms (user_id, schedule_id, effective_from, frequency, interval, day_of_month, weekday, ordinal,
    business_day_ordinal, adjustment, calendar, start, until, count, amount, first_sequence)
VALUES (@user_id, @schedule_id, @effective_from, @frequency, @interval, sqlc.narg(day_of_month), sqlc.narg(weekday), sqlc.narg(ordinal),
    sqlc.narg(business_day_ordinal), @adjustment,
    (SELECT calendar FROM planning_schedule WHERE user_id = @user_id AND id = @schedule_id), @start, sqlc.narg(until), sqlc.narg(count), @amount, sqlc.narg(first_sequence));

-- name: GetSchedule :one
SELECT * FROM planning_schedule WHERE user_id = @user_id AND id = @id;

-- name: LockSchedule :one
SELECT * FROM planning_schedule WHERE user_id = @user_id AND id = @id FOR UPDATE;

-- name: ListSchedules :many
SELECT * FROM planning_schedule
WHERE user_id = @user_id AND (sqlc.narg(after_id)::uuid IS NULL OR id > sqlc.narg(after_id)::uuid)
ORDER BY id
LIMIT @row_limit;

-- name: SchedulesOfUser :many
SELECT * FROM planning_schedule WHERE user_id = @user_id ORDER BY id;

-- name: ListTerms :many
SELECT * FROM planning_schedule_terms WHERE user_id = @user_id AND schedule_id = ANY(@schedule_ids::uuid[]) ORDER BY schedule_id, effective_from;

-- name: InsertPause :exec
INSERT INTO planning_schedule_pause (user_id, schedule_id, period) VALUES (@user_id, @schedule_id, daterange(@from_date::date, @to_date::date, '[]'));

-- name: ListPauses :many
SELECT schedule_id, lower(period)::date AS from_date, (upper(period) - 1)::date AS to_date
FROM planning_schedule_pause WHERE user_id = @user_id AND schedule_id = ANY(@schedule_ids::uuid[]) ORDER BY schedule_id, lower(period);

-- name: SetGeneratedUntil :exec
UPDATE planning_schedule SET generated_until = @generated_until, updated_at = now() WHERE user_id = @user_id AND id = @id;

-- name: ScheduleRefs :many
-- Every schedule across users: what a backfill of their history reads (P7 amendment A127).
SELECT user_id, id FROM planning_schedule ORDER BY user_id, id;

-- name: SchedulesBehind :many
-- A53: schedules whose occurrences stop before the horizon, across users.
SELECT user_id, id FROM planning_schedule
WHERE generated_until < @horizon AND (ends_on IS NULL OR generated_until < ends_on)
ORDER BY user_id, id;

-- name: InsertOccurrences :exec
-- Generation is idempotent by (schedule_id, sequence) (P7 amendment A49).
INSERT INTO planning_occurrence (user_id, schedule_id, sequence, expected_on, expected_amount, state)
SELECT @user_id::bigint, @schedule_id::uuid, unnest(@sequences::int[]), unnest(@dates::text[])::date, unnest(@amounts::bigint[]), 'expected'
ON CONFLICT (schedule_id, sequence) DO NOTHING;

-- name: ListOccurrences :many
SELECT * FROM planning_occurrence
WHERE user_id = @user_id AND expected_on BETWEEN @from_date AND @to_date
  AND (sqlc.narg(schedule_id)::uuid IS NULL OR schedule_id = sqlc.narg(schedule_id)::uuid)
ORDER BY expected_on, schedule_id, sequence;

-- name: SetEndsOn :exec
UPDATE planning_schedule SET ends_on = @ends_on, updated_at = now() WHERE user_id = @user_id AND id = @id;

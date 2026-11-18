-- name: InsertGoal :one
INSERT INTO
    planning_goal (books_id, name, target, currency, due_on, counts_as_savings)
VALUES
    (@books_id, @name, @target, @currency, @due_on, @counts_as_savings)
RETURNING
    *;

-- name: UpsertGoalAccounts :exec
INSERT INTO
    planning_goal_account (books_id, goal_id, account_id, allocated)
SELECT
    @books_id::bigint,
    @goal_id::uuid,
    unnest(@account_ids::UUID[]),
    @allocated::boolean
ON CONFLICT (goal_id, account_id) DO UPDATE
SET
    allocated = EXCLUDED.allocated;

-- name: GetGoal :one
SELECT
    *
FROM
    planning_goal
WHERE
    books_id = @books_id
    AND id = @id;

-- name: ListGoals :many
SELECT
    *
FROM
    planning_goal
WHERE
    books_id = @books_id
    AND (
        sqlc.narg (after_id)::uuid IS NULL
        OR id > sqlc.narg (after_id)::uuid
    )
ORDER BY
    id
LIMIT
    @row_limit;

-- name: ListGoalAccounts :many
SELECT
    goal_id,
    account_id,
    allocated
FROM
    planning_goal_account
WHERE
    books_id = @books_id
    AND goal_id = ANY (@goal_ids::UUID[])
ORDER BY
    goal_id,
    account_id;

-- name: UpdateGoal :one
UPDATE planning_goal
SET
    name = @name,
    target = @target,
    currency = @currency,
    due_on = @due_on,
    counts_as_savings = @counts_as_savings
WHERE
    books_id = @books_id
    AND id = @id
RETURNING
    *;

-- name: DeleteGoalAccountsExcept :exec
DELETE FROM planning_goal_account
WHERE
    books_id = @books_id
    AND goal_id = @goal_id
    AND NOT (account_id = ANY (@keep::UUID[]));

-- name: DeleteAllocationsOfAccounts :exec
DELETE FROM planning_goal_allocation
WHERE
    books_id = @books_id
    AND goal_id = @goal_id
    AND account_id = ANY (@account_ids::UUID[]);

-- name: DeleteGoal :execrows
DELETE FROM planning_goal
WHERE
    books_id = @books_id
    AND id = @id;

-- name: UpsertGoalExpense :exec
INSERT INTO
    planning_goal_expense (books_id, transaction_id, goal_id)
VALUES
    (@books_id, @transaction_id, @goal_id)
ON CONFLICT (books_id, transaction_id) DO UPDATE
SET
    goal_id = EXCLUDED.goal_id;

-- name: DeleteGoalExpense :execrows
DELETE FROM planning_goal_expense
WHERE
    books_id = @books_id
    AND goal_id = @goal_id
    AND transaction_id = @transaction_id;

-- name: ListGoalExpenses :many
SELECT
    goal_id,
    transaction_id
FROM
    planning_goal_expense
WHERE
    books_id = @books_id
ORDER BY
    transaction_id;

-- name: InsertGoalAllocation :one
INSERT INTO
    planning_goal_allocation (books_id, goal_id, account_id, booked_on, amount)
VALUES
    (@books_id, @goal_id, @account_id, @booked_on, @amount)
RETURNING
    *;

-- name: UpsertOccurrenceAllocation :exec
INSERT INTO
    planning_goal_allocation (books_id, goal_id, account_id, booked_on, amount, occurrence_id)
VALUES
    (@books_id, @goal_id, @account_id, @booked_on, @amount, @occurrence_id::uuid)
ON CONFLICT (books_id, occurrence_id)
WHERE
    occurrence_id IS NOT NULL DO UPDATE
SET
    goal_id = EXCLUDED.goal_id,
    account_id = EXCLUDED.account_id,
    booked_on = EXCLUDED.booked_on,
    amount = EXCLUDED.amount;

-- name: DeleteOccurrenceAllocation :exec
DELETE FROM planning_goal_allocation
WHERE
    books_id = @books_id
    AND occurrence_id = @occurrence_id::uuid;

-- name: GetGoalAllocation :one
SELECT
    *
FROM
    planning_goal_allocation
WHERE
    books_id = @books_id
    AND goal_id = @goal_id
    AND id = @id;

-- name: DeleteGoalAllocation :execrows
DELETE FROM planning_goal_allocation
WHERE
    books_id = @books_id
    AND goal_id = @goal_id
    AND id = @id;

-- name: ListAllocations :many
SELECT
    *
FROM
    planning_goal_allocation
WHERE
    books_id = @books_id
ORDER BY
    booked_on DESC,
    id DESC;

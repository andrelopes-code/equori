-- name: InsertGoal :one
INSERT INTO
    planning_goal (books_id, name, target, currency, due_on, counts_as_savings)
VALUES
    (@books_id, @name, @target, @currency, @due_on, @counts_as_savings)
RETURNING
    *;

-- name: InsertGoalAccounts :exec
INSERT INTO
    planning_goal_account (books_id, goal_id, account_id)
SELECT
    @books_id::bigint,
    @goal_id::uuid,
    unnest(@account_ids::UUID[]);

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
    account_id
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

-- name: DeleteGoalAccounts :exec
DELETE FROM planning_goal_account
WHERE
    books_id = @books_id
    AND goal_id = @goal_id;

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

-- name: InsertGoal :one
INSERT INTO
    planning_goal (user_id, name, target, currency, due_on)
VALUES
    (@user_id, @name, @target, @currency, @due_on)
RETURNING
    *;

-- name: InsertGoalAccounts :exec
INSERT INTO
    planning_goal_account (user_id, goal_id, account_id)
SELECT
    @user_id::bigint,
    @goal_id::uuid,
    unnest(@account_ids::UUID[]);

-- name: GetGoal :one
SELECT
    *
FROM
    planning_goal
WHERE
    user_id = @user_id
    AND id = @id;

-- name: ListGoals :many
SELECT
    *
FROM
    planning_goal
WHERE
    user_id = @user_id
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
    user_id = @user_id
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
    due_on = @due_on
WHERE
    user_id = @user_id
    AND id = @id
RETURNING
    *;

-- name: DeleteGoalAccounts :exec
DELETE FROM planning_goal_account
WHERE
    user_id = @user_id
    AND goal_id = @goal_id;

-- name: DeleteGoal :execrows
DELETE FROM planning_goal
WHERE
    user_id = @user_id
    AND id = @id;

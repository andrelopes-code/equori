-- name: GetProjectionPlan :one
SELECT
    withdrawal_age,
    last_age,
    real_return_bp,
    inflation_bp,
    withdrawal_mode,
    income,
    withdrawal_rate_bp,
    currency,
    baseline_date,
    baseline_value
FROM
    portfolio_projection_plan
WHERE
    books_id = @books_id
    AND member_id = @member_id;

-- name: ListProjectionChanges :many
SELECT
    MONTH,
    amount
FROM
    portfolio_projection_change
WHERE
    books_id = @books_id
    AND member_id = @member_id
ORDER BY
    MONTH;

-- name: UpsertProjectionPlan :exec
INSERT INTO
    portfolio_projection_plan (
        books_id,
        member_id,
        withdrawal_age,
        last_age,
        real_return_bp,
        inflation_bp,
        withdrawal_mode,
        income,
        withdrawal_rate_bp,
        currency,
        baseline_date,
        baseline_value
    )
VALUES
    (
        @books_id,
        @member_id,
        @withdrawal_age,
        @last_age,
        @real_return_bp,
        @inflation_bp,
        @withdrawal_mode,
        @income,
        @withdrawal_rate_bp,
        @currency,
        @baseline_date,
        @baseline_value
    )
ON CONFLICT (books_id, member_id) DO UPDATE
SET
    withdrawal_age = excluded.withdrawal_age,
    last_age = excluded.last_age,
    real_return_bp = excluded.real_return_bp,
    inflation_bp = excluded.inflation_bp,
    withdrawal_mode = excluded.withdrawal_mode,
    income = excluded.income,
    withdrawal_rate_bp = excluded.withdrawal_rate_bp;

-- name: DeleteProjectionChangesFrom :exec
DELETE FROM portfolio_projection_change
WHERE
    books_id = @books_id
    AND member_id = @member_id
    AND MONTH >= @month;

-- name: InsertProjectionChange :exec
INSERT INTO
    portfolio_projection_change (books_id, member_id, MONTH, amount)
VALUES
    (@books_id, @member_id, @month, @amount);

-- name: DeleteProjectionPlan :execrows
DELETE FROM portfolio_projection_plan
WHERE
    books_id = @books_id
    AND member_id = @member_id;

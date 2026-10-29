-- name: GetBudgetReference :one
SELECT
    *
FROM
    planning_budget_reference
WHERE
    user_id = @user_id;

-- name: UpsertBudgetReference :exec
INSERT INTO
    planning_budget_reference (user_id, source, amount, currency)
VALUES
    (@user_id, @source, sqlc.narg (amount), @currency)
ON CONFLICT (user_id) DO UPDATE
SET
    source = EXCLUDED.source,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency;

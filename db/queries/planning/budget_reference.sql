-- name: GetBudgetReference :one
SELECT
    *
FROM
    planning_budget_reference
WHERE
    books_id = @books_id;

-- name: UpsertBudgetReference :exec
INSERT INTO
    planning_budget_reference (books_id, source, amount, currency, savings_target_bp)
VALUES
    (
        @books_id,
        @source,
        sqlc.narg (amount),
        @currency,
        sqlc.narg (savings_target_bp)
    )
ON CONFLICT (books_id) DO UPDATE
SET
    source = EXCLUDED.source,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    savings_target_bp = EXCLUDED.savings_target_bp;

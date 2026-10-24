-- name: InsertBudget :one
INSERT INTO planning_budget (user_id, category_account_id, rollover, currency)
VALUES (@user_id, @category_account_id, @rollover, @currency)
RETURNING *;

-- name: InsertBudgetAmount :exec
INSERT INTO planning_budget_amount (user_id, budget_id, effective_from, amount)
VALUES (@user_id, @budget_id, @effective_from, @amount);

-- name: GetBudget :one
SELECT * FROM planning_budget WHERE user_id = @user_id AND id = @id;

-- name: ListBudgets :many
SELECT * FROM planning_budget
WHERE user_id = @user_id AND (sqlc.narg(after_id)::uuid IS NULL OR id > sqlc.narg(after_id)::uuid)
ORDER BY id
LIMIT @row_limit;

-- name: ListBudgetAmounts :many
SELECT * FROM planning_budget_amount WHERE user_id = @user_id AND budget_id = ANY(@budget_ids::uuid[]) ORDER BY budget_id, effective_from;

-- name: LockBudget :one
SELECT * FROM planning_budget WHERE user_id = @user_id AND id = @id FOR UPDATE;

-- name: DeleteBudget :execrows
-- S144: the amounts go with the budget (ON DELETE CASCADE).
DELETE FROM planning_budget WHERE user_id = @user_id AND id = @id;

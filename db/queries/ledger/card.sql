-- name: InsertBillingRule :one
INSERT INTO ledger_billing_cycle_rule (
    user_id, account_id, effective_from, closing_day, due_day, closing_day_assignment, due_date_adjustment, calendar
) VALUES (@user_id, @account_id, @effective_from, @closing_day, @due_day, @closing_day_assignment, @due_date_adjustment, @calendar)
RETURNING *;

-- name: ListBillingRules :many
SELECT * FROM ledger_billing_cycle_rule WHERE user_id = $1 AND account_id = $2 ORDER BY effective_from;

-- name: InsertCreditLimit :one
INSERT INTO ledger_credit_limit (user_id, account_id, effective_from, amount) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: ListCreditLimits :many
SELECT * FROM ledger_credit_limit WHERE user_id = $1 AND account_id = $2 ORDER BY effective_from;

-- name: InsertCard :one
INSERT INTO ledger_card (user_id, account_id, holder, last_four, virtual) VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: ListCards :many
SELECT * FROM ledger_card WHERE user_id = $1 AND account_id = $2 ORDER BY created_at, id;

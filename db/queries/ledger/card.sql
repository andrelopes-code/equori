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

-- name: EnsureStatement :one
WITH inserted AS (
    INSERT INTO ledger_statement (user_id, account_id, reference_month, closing_date, due_date)
    VALUES (@user_id, @account_id, @reference_month, @closing_date, @due_date)
    ON CONFLICT (account_id, reference_month) DO NOTHING
    RETURNING id
)
SELECT id FROM inserted
UNION ALL
SELECT id FROM ledger_statement WHERE account_id = @account_id AND reference_month = @reference_month
LIMIT 1;

-- name: ListStatements :many
SELECT * FROM ledger_statement WHERE user_id = $1 AND account_id = $2 ORDER BY reference_month;

-- name: ListStatementLines :many
SELECT p.statement_id, p.card_role, p.amount
FROM ledger_posting p
WHERE p.user_id = $1 AND p.account_id = $2 AND NOT p.voided AND p.statement_id IS NOT NULL;

-- name: GetStatement :one
SELECT * FROM ledger_statement WHERE user_id = $1 AND id = $2;

-- name: ListStatementPostings :many
SELECT p.transaction_id, t.date, t.description, p.card_role, p.amount,
       p.installment_plan_id, p.installment_number, p.installment_count
FROM ledger_posting p
JOIN ledger_transaction t ON t.id = p.transaction_id
WHERE p.user_id = $1 AND p.statement_id = $2 AND NOT p.voided
ORDER BY t.date, t.id, p.position;

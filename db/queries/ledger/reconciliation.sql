-- name: InsertBalanceAssertion :one
INSERT INTO ledger_balance_assertion (user_id, account_id, date, amount, source)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListBalanceAssertions :many
SELECT * FROM ledger_balance_assertion WHERE user_id = $1 AND account_id = $2 ORDER BY date DESC, id DESC;

-- name: LastReconciledOn :one
SELECT date FROM ledger_reconciliation WHERE user_id = $1 AND account_id = $2 ORDER BY date DESC LIMIT 1;

-- name: InsertReconciliation :exec
INSERT INTO ledger_reconciliation (user_id, account_id, date, assertion_id, statement_id, difference, resolution, resolution_transaction_id)
VALUES (@user_id, @account_id, @date, sqlc.narg(assertion_id), sqlc.narg(statement_id), @difference, @resolution, sqlc.narg(resolution_transaction_id));

-- name: ReconcileAccountPostings :exec
UPDATE ledger_posting SET status = 'reconciled'
WHERE user_id = @user_id AND account_id = @account_id
  AND NOT voided
  AND status <> 'reconciled'
  AND coalesce(settled_on, booked_on) <= @on_date::date;

-- name: FirstSettledOn :one
SELECT coalesce(settled_on, booked_on)::date FROM ledger_posting
WHERE user_id = $1 AND account_id = $2 AND NOT voided
ORDER BY 1 LIMIT 1;

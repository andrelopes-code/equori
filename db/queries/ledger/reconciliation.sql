-- name: InsertBalanceAssertion :one
INSERT INTO ledger_balance_assertion (user_id, account_id, date, amount, source)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListBalanceAssertions :many
SELECT a.*, EXISTS (SELECT 1 FROM ledger_reconciliation r WHERE r.assertion_id = a.id) AS reconciled
FROM ledger_balance_assertion a
WHERE a.user_id = $1 AND a.account_id = $2
ORDER BY a.date DESC, a.id DESC;

-- name: GetBalanceAssertion :one
SELECT a.*, EXISTS (SELECT 1 FROM ledger_reconciliation r WHERE r.assertion_id = a.id) AS reconciled
FROM ledger_balance_assertion a
WHERE a.user_id = $1 AND a.id = $2;

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

-- name: EnableReconciledUnlock :exec
SELECT set_config('equori.unlock_reconciled', 'on', true);

-- name: UnreconcileAccountPostings :exec
UPDATE ledger_posting SET status = 'cleared'
WHERE user_id = @user_id AND account_id = @account_id
  AND status = 'reconciled'
  AND coalesce(settled_on, booked_on) >= @from_date::date;

-- name: DeleteReconciliationsFrom :exec
DELETE FROM ledger_reconciliation WHERE user_id = @user_id AND account_id = @account_id AND date >= @from_date::date;

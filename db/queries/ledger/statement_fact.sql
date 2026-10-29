-- name: HasOpeningBalance :one
SELECT EXISTS (
    SELECT 1 FROM ledger_posting c
    JOIN ledger_transaction t ON t.id = c.transaction_id AND t.voided_at IS NULL
    JOIN ledger_posting o ON o.transaction_id = c.transaction_id
    JOIN ledger_account a ON a.id = o.account_id AND a.system_role = 'opening_balances'
    WHERE c.user_id = @user_id AND c.account_id = @account_id)::bool;

-- name: ListStatementClosings :many
SELECT reference_month, closing_date FROM ledger_statement WHERE user_id = @user_id AND account_id = @account_id;

-- name: UpsertStatementFact :exec
INSERT INTO ledger_statement_fact (user_id, statement_id, source, closing_date, due_date, total, minimum)
VALUES (@user_id, @statement_id, @source, sqlc.narg(closing_date), @due_date, @total, sqlc.narg(minimum))
ON CONFLICT (statement_id, source) DO UPDATE SET
    closing_date = excluded.closing_date, due_date = excluded.due_date, total = excluded.total,
    minimum = excluded.minimum, reported_at = now();

-- name: DeleteStatementFact :exec
DELETE FROM ledger_statement_fact WHERE user_id = @user_id AND statement_id = @statement_id AND source = @source;

-- name: ListStatementFacts :many
SELECT f.* FROM ledger_statement_fact f
JOIN ledger_statement s ON s.id = f.statement_id
WHERE f.user_id = @user_id AND s.account_id = @account_id;

-- name: ListRedatablePostings :many
-- A86: card postings billed by their date: no external record, no installment, not reconciled.
SELECT p.id, p.booked_on, p.statement_id::uuid AS statement_id FROM ledger_posting p
WHERE p.user_id = @user_id AND p.account_id = @account_id AND NOT p.voided AND p.statement_id IS NOT NULL
  AND p.external_record_id IS NULL AND p.installment_plan_id IS NULL AND p.status <> 'reconciled';

-- name: MovePostingStatement :exec
UPDATE ledger_posting SET statement_id = @statement_id WHERE user_id = @user_id AND id = @id;

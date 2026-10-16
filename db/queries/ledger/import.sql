-- name: GetTransactionIDByExternalRecord :one
SELECT id FROM ledger_transaction WHERE user_id = $1 AND external_record_id = $2;

-- name: ListMatchCandidates :many
-- Transactions with a non-voided posting on the account for the amount within the window,
-- not linked to an external record yet (I07).
SELECT DISTINCT t.id, t.date
FROM ledger_transaction t
JOIN ledger_posting p ON p.transaction_id = t.id
WHERE t.user_id = @user_id AND t.external_record_id IS NULL
  AND p.account_id = @account_id AND p.amount = @amount AND NOT p.voided
  AND p.booked_on BETWEEN @from_date::date AND @to_date::date
ORDER BY t.date, t.id;

-- name: LinkExternalRecord :exec
UPDATE ledger_transaction SET external_record_id = @external_record_id, updated_at = now()
WHERE user_id = @user_id AND id = @id;

-- name: ClearPendingPostings :exec
UPDATE ledger_posting SET status = 'cleared'
WHERE user_id = @user_id AND transaction_id = @transaction_id AND account_id = @account_id AND status = 'pending';

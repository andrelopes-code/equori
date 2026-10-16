-- name: GetTransactionIDByExternalRecord :one
SELECT id FROM ledger_transaction WHERE user_id = $1 AND external_record_id = $2;

-- name: ListUnlinkedPostings :many
-- Postings of the account in the window whose transaction carries no external record and
-- is not voided: what statement lines may confirm (I07).
SELECT t.id AS transaction_id, p.booked_on, p.amount
FROM ledger_posting p
JOIN ledger_transaction t ON t.id = p.transaction_id
WHERE p.user_id = @user_id AND p.account_id = @account_id AND NOT p.voided
  AND t.external_record_id IS NULL
  AND p.booked_on BETWEEN @from_date::date AND @to_date::date
ORDER BY p.booked_on, t.id;

-- name: LinkExternalRecord :exec
UPDATE ledger_transaction SET external_record_id = @external_record_id, updated_at = now()
WHERE user_id = @user_id AND id = @id;

-- name: ClearPendingPostings :exec
UPDATE ledger_posting SET status = 'cleared'
WHERE user_id = @user_id AND transaction_id = @transaction_id AND account_id = @account_id AND status = 'pending';

-- name: ListTransactionsByExternalRecords :many
SELECT external_record_id, id FROM ledger_transaction
WHERE user_id = @user_id AND external_record_id = ANY(@record_ids::uuid[]);

-- name: GetTransactionLinkForUpdate :one
SELECT external_record_id, (voided_at IS NOT NULL)::boolean AS voided FROM ledger_transaction
WHERE user_id = $1 AND id = $2
FOR UPDATE;

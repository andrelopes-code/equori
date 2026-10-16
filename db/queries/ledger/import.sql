-- name: GetTransactionIDByExternalRecord :one
SELECT transaction_id FROM ledger_posting WHERE user_id = $1 AND external_record_id = $2;

-- name: ListUnlinkedPostings :many
-- The first unlinked posting of each non-voided transaction on the account in the window:
-- what statement lines may confirm (I07, P5b amendment A27).
SELECT u.transaction_id, u.booked_on, u.amount FROM (
    SELECT DISTINCT ON (p.transaction_id) p.transaction_id, p.booked_on, p.amount
    FROM ledger_posting p
    WHERE p.user_id = @user_id AND p.account_id = @account_id AND NOT p.voided
      AND p.external_record_id IS NULL
      AND p.booked_on BETWEEN @from_date::date AND @to_date::date
    ORDER BY p.transaction_id, p.position
) u
ORDER BY u.booked_on, u.transaction_id;

-- name: LinkExternalRecord :exec
UPDATE ledger_posting SET external_record_id = @external_record_id
WHERE user_id = @user_id AND id = @id;

-- name: ClearPendingPostings :exec
UPDATE ledger_posting SET status = 'cleared'
WHERE user_id = @user_id AND transaction_id = @transaction_id AND account_id = @account_id AND status = 'pending';

-- name: ListTransactionsByExternalRecords :many
SELECT external_record_id::uuid AS external_record_id, transaction_id FROM ledger_posting
WHERE user_id = @user_id AND external_record_id = ANY(@record_ids::uuid[]);

-- name: LockAccountPostingLinks :many
-- The transaction's postings on the account, locked with the transaction, in position order.
SELECT p.id, p.external_record_id, (t.voided_at IS NOT NULL)::boolean AS voided
FROM ledger_posting p
JOIN ledger_transaction t ON t.id = p.transaction_id
WHERE p.user_id = $1 AND p.transaction_id = $2 AND p.account_id = $3
ORDER BY p.position
FOR UPDATE OF p, t;

-- name: LockImportedPosting :one
-- The posting an external record confirms (P6 amendment A36).
SELECT id, account_id, status, card_role FROM ledger_posting
WHERE user_id = @user_id AND external_record_id = @external_record_id
FOR UPDATE;

-- name: SettleImportedPosting :exec
UPDATE ledger_posting SET status = @status, statement_id = coalesce(sqlc.narg(statement_id), statement_id)
WHERE user_id = @user_id AND id = @id;

-- name: ReleaseExternalRecord :exec
-- A38: the posting stays; a line with another id may confirm it again.
UPDATE ledger_posting SET external_record_id = NULL
WHERE user_id = @user_id AND external_record_id = @external_record_id;

-- name: GetRecordPosting :one
SELECT transaction_id, installment_plan_id FROM ledger_posting WHERE user_id = $1 AND external_record_id = $2;

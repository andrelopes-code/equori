-- name: CountTransactions :one
SELECT count(*) FROM ledger_transaction WHERE user_id = $1;

-- name: InsertTransaction :one
INSERT INTO ledger_transaction (id, user_id, date, description, payee_id, balancing_currency, origin, version, external_record_id)
VALUES (@id, @user_id, @date, @description, sqlc.narg(payee_id), @balancing_currency, @origin, @version, sqlc.narg(external_record_id))
RETURNING *;

-- name: UpdateTransaction :exec
UPDATE ledger_transaction
SET date = @date, description = @description, payee_id = sqlc.narg(payee_id),
    balancing_currency = @balancing_currency, origin = @origin, version = @version, updated_at = now()
WHERE user_id = @user_id AND id = @id;

-- name: VoidTransaction :exec
UPDATE ledger_transaction SET voided_at = $3, void_reason = $4, updated_at = now()
WHERE user_id = $1 AND id = $2;

-- name: GetTransaction :one
SELECT * FROM ledger_transaction WHERE user_id = $1 AND id = $2;

-- name: GetTransactionForUpdate :one
SELECT * FROM ledger_transaction WHERE user_id = $1 AND id = $2 FOR UPDATE;

-- name: InsertPostings :batchexec
-- One round trip for all postings of a transaction.
INSERT INTO ledger_posting (
    user_id, transaction_id, account_id, position, amount, weight, booked_on, settled_on,
    status, original_amount, original_instrument, memo,
    statement_id, card_role, installment_plan_id, installment_number, installment_count
) VALUES (
    @user_id, @transaction_id, @account_id, @position, @amount, @weight, @booked_on, sqlc.narg(settled_on),
    @status, sqlc.narg(original_amount), sqlc.narg(original_instrument), sqlc.narg(memo),
    sqlc.narg(statement_id), sqlc.narg(card_role), sqlc.narg(installment_plan_id),
    sqlc.narg(installment_number), sqlc.narg(installment_count)
);

-- name: DeletePostings :exec
DELETE FROM ledger_posting WHERE transaction_id = $1;

-- name: ListPostings :many
SELECT p.*, a.instrument AS account_instrument, t.balancing_currency, s.reference_month AS statement_reference
FROM ledger_posting p
JOIN ledger_account a ON a.id = p.account_id
JOIN ledger_transaction t ON t.id = p.transaction_id
LEFT JOIN ledger_statement s ON s.id = p.statement_id
WHERE p.user_id = $1 AND p.transaction_id = ANY(@transaction_ids::uuid[])
ORDER BY p.transaction_id, p.position;

-- name: DeleteTransactionTags :exec
DELETE FROM ledger_transaction_tag WHERE transaction_id = $1;

-- name: InsertTransactionTag :exec
INSERT INTO ledger_transaction_tag (user_id, transaction_id, tag_id) VALUES ($1, $2, $3);

-- name: ListTransactionTags :many
SELECT tt.transaction_id, g.name
FROM ledger_transaction_tag tt
JOIN ledger_tag g ON g.id = tt.tag_id
WHERE tt.user_id = $1 AND tt.transaction_id = ANY(@transaction_ids::uuid[])
ORDER BY g.name;

-- name: DeleteLinksFrom :exec
DELETE FROM ledger_link WHERE from_transaction_id = $1;

-- name: InsertLink :exec
INSERT INTO ledger_link (user_id, from_transaction_id, to_transaction_id, link_type) VALUES ($1, $2, $3, $4);

-- name: ListLinksFrom :many
SELECT * FROM ledger_link WHERE user_id = $1 AND from_transaction_id = ANY(@transaction_ids::uuid[])
ORDER BY from_transaction_id, link_type, to_transaction_id;

-- name: InsertVersion :exec
INSERT INTO ledger_transaction_version (transaction_id, version, snapshot, reason) VALUES ($1, $2, $3, $4);

-- name: ListVersions :many
SELECT v.* FROM ledger_transaction_version v
JOIN ledger_transaction t ON t.id = v.transaction_id
WHERE t.user_id = $1 AND v.transaction_id = $2
ORDER BY v.version;

-- name: ListTransactions :many
SELECT t.* FROM ledger_transaction t
WHERE t.user_id = @user_id
  AND (sqlc.narg(account_id)::uuid IS NULL OR EXISTS (
      SELECT 1 FROM ledger_posting p WHERE p.transaction_id = t.id AND p.account_id = sqlc.narg(account_id)::uuid))
  AND (sqlc.narg(payee_id)::uuid IS NULL OR t.payee_id = sqlc.narg(payee_id)::uuid)
  AND (sqlc.narg(tag)::text IS NULL OR EXISTS (
      SELECT 1 FROM ledger_transaction_tag tt JOIN ledger_tag g ON g.id = tt.tag_id
      WHERE tt.transaction_id = t.id AND g.name = sqlc.narg(tag)::text))
  AND (sqlc.narg(from_date)::date IS NULL OR t.date >= sqlc.narg(from_date)::date)
  AND (sqlc.narg(to_date)::date IS NULL OR t.date <= sqlc.narg(to_date)::date)
  AND (sqlc.narg(after_date)::date IS NULL OR (t.date, t.id) < (sqlc.narg(after_date)::date, sqlc.narg(after_id)::uuid))
ORDER BY t.date DESC, t.id DESC
LIMIT @row_limit;

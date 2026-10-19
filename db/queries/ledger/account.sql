-- name: InsertAccount :one
INSERT INTO ledger_account (
    user_id, name, account_class, kind, instrument, parent_id, institution_id,
    counterparty_payee_id, opened_on, closed_on, yield_mode, system_role, color, icon
) VALUES (
    @user_id, @name, @account_class, sqlc.narg(kind), @instrument, sqlc.narg(parent_id), sqlc.narg(institution_id),
    sqlc.narg(counterparty_payee_id), @opened_on, sqlc.narg(closed_on), @yield_mode, sqlc.narg(system_role),
    sqlc.narg(color), sqlc.narg(icon)
) RETURNING *;

-- name: UpdateAccount :one
UPDATE ledger_account
SET name = @name, parent_id = sqlc.narg(parent_id), institution_id = sqlc.narg(institution_id),
    closed_on = sqlc.narg(closed_on), yield_mode = @yield_mode, color = sqlc.narg(color), icon = sqlc.narg(icon),
    updated_at = now()
WHERE user_id = @user_id AND id = @id
RETURNING *;

-- name: GetAccount :one
SELECT * FROM ledger_account WHERE user_id = $1 AND id = $2;

-- name: GetAccountsByIDs :many
SELECT * FROM ledger_account WHERE user_id = $1 AND id = ANY(@ids::uuid[]);

-- name: ListAccounts :many
SELECT *, lower(name)::text AS sort_name FROM ledger_account
WHERE user_id = @user_id
  AND (sqlc.narg(after_class)::text IS NULL
       OR (account_class, lower(name), id) > (sqlc.narg(after_class)::text, sqlc.narg(after_name)::text, sqlc.narg(after_id)::uuid))
ORDER BY account_class, lower(name), id
LIMIT @row_limit;

-- name: SetSystemAccountsInstrument :exec
UPDATE ledger_account SET instrument = $2, updated_at = now()
WHERE user_id = $1 AND system_role IS NOT NULL;

-- name: AccountHasChildren :one
SELECT EXISTS (SELECT 1 FROM ledger_account WHERE user_id = $1 AND parent_id = $2);

-- name: AccountTotals :one
SELECT coalesce(sum(p.amount), 0)::bigint AS total, coalesce(max(p.booked_on), '1900-01-01')::date AS last_booked_on
FROM ledger_posting p
WHERE p.user_id = $1 AND p.account_id = $2 AND NOT p.voided;

-- name: GetAccountForUpdate :one
SELECT * FROM ledger_account WHERE user_id = $1 AND id = $2 FOR UPDATE;

-- name: TransactionsWithAccount :many
-- A75: the non-voided transactions with a posting on the account.
SELECT DISTINCT t.id FROM ledger_transaction t
JOIN ledger_posting p ON p.transaction_id = t.id
WHERE t.user_id = @user_id AND p.account_id = @account_id AND t.voided_at IS NULL
ORDER BY t.id;

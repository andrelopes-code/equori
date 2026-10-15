-- name: BalanceBookedAt :one
WITH RECURSIVE tree AS (
    SELECT a.id FROM ledger_account a WHERE a.user_id = @user_id AND a.id = @account_id
    UNION ALL
    SELECT c.id FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT coalesce(sum(p.amount), 0)::bigint
FROM ledger_posting p
WHERE p.account_id IN (SELECT id FROM tree)
  AND NOT p.voided
  AND p.booked_on <= @on_date;

-- name: BalanceSettledAt :one
WITH RECURSIVE tree AS (
    SELECT a.id FROM ledger_account a WHERE a.user_id = @user_id AND a.id = @account_id
    UNION ALL
    SELECT c.id FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT coalesce(sum(p.amount), 0)::bigint
FROM ledger_posting p
WHERE p.account_id IN (SELECT id FROM tree)
  AND NOT p.voided
  AND coalesce(p.settled_on, p.booked_on) <= @on_date;

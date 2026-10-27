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

-- name: AccountBalancesBookedAt :many
SELECT a.id, a.instrument, coalesce(sum(p.amount), 0)::bigint AS total
FROM ledger_account a
LEFT JOIN ledger_posting p ON p.account_id = a.id AND NOT p.voided AND p.booked_on <= @on_date
WHERE a.user_id = @user_id AND a.account_class IN ('asset', 'liability')
GROUP BY a.id
ORDER BY a.name, a.id;

-- name: AccountBalancesSettledAt :many
SELECT a.id, a.instrument, coalesce(sum(p.amount), 0)::bigint AS total
FROM ledger_account a
LEFT JOIN ledger_posting p ON p.account_id = a.id AND NOT p.voided AND coalesce(p.settled_on, p.booked_on) <= @on_date
WHERE a.user_id = @user_id AND a.account_class IN ('asset', 'liability')
GROUP BY a.id
ORDER BY a.name, a.id;

-- name: CategoryTotal :one
-- P7 amendment A54: weights of the non-voided postings of a category subtree booked in [from, to).
WITH RECURSIVE tree AS (
    SELECT a.id FROM ledger_account a WHERE a.user_id = @user_id AND a.id = @account_id
    UNION ALL
    SELECT c.id FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT coalesce(sum(p.weight), 0)::bigint
FROM ledger_posting p
WHERE p.account_id IN (SELECT id FROM tree)
  AND NOT p.voided
  AND p.booked_on >= @from_date AND p.booked_on < @to_date;

-- name: CategoryMonthlyTotals :many
-- CategoryTotal grouped by month in one query (P7 final review).
WITH RECURSIVE tree AS (
    SELECT a.id FROM ledger_account a WHERE a.user_id = @user_id AND a.id = @account_id
    UNION ALL
    SELECT c.id FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT date_trunc('month', p.booked_on)::date AS month, sum(p.weight)::bigint AS total
FROM ledger_posting p
WHERE p.account_id IN (SELECT id FROM tree)
  AND NOT p.voided
  AND p.booked_on >= @from_date AND p.booked_on < @to_date
GROUP BY 1
ORDER BY 1;

-- name: TreeInstruments :many
WITH RECURSIVE tree AS (
    SELECT a.id, a.instrument FROM ledger_account a WHERE a.user_id = @user_id AND a.id = @account_id
    UNION ALL
    SELECT c.id, c.instrument FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT DISTINCT instrument FROM tree ORDER BY instrument;

-- name: TreeBalancesByInstrument :many
-- P8 amendment A65: the balance of each instrument held in the account and its sub-accounts.
WITH RECURSIVE tree AS (
    SELECT a.id, a.instrument FROM ledger_account a WHERE a.user_id = @user_id AND a.id = @account_id
    UNION ALL
    SELECT c.id, c.instrument FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT tree.instrument, coalesce(sum(p.amount), 0)::bigint AS total
FROM tree
LEFT JOIN ledger_posting p ON p.account_id = tree.id AND NOT p.voided
    AND CASE WHEN @settled::boolean THEN coalesce(p.settled_on, p.booked_on) ELSE p.booked_on END <= @on_date
GROUP BY tree.instrument
ORDER BY tree.instrument;

-- name: TreeExternalFlows :many
-- Investments design 4.3: the money that entered (positive) or left (negative) the accounts and
-- their sub-accounts, taken as one tree, in each transaction of [from, to] that also touches a
-- balance account outside it, as the negated weights of the outside postings, in the
-- transaction's balancing currency. A transfer between two roots is internal.
WITH RECURSIVE tree AS (
    SELECT a.id FROM ledger_account a WHERE a.user_id = @user_id AND a.id = ANY(@account_ids::uuid[])
    UNION
    SELECT c.id FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT t.date, t.balancing_currency, (-sum(o.weight))::bigint AS flow
FROM ledger_transaction t
JOIN ledger_posting o ON o.transaction_id = t.id AND NOT o.voided AND o.account_id NOT IN (SELECT id FROM tree)
JOIN ledger_account oa ON oa.id = o.account_id AND oa.account_class IN ('asset', 'liability')
WHERE t.user_id = @user_id AND t.voided_at IS NULL AND t.date BETWEEN @from_date AND @to_date
  AND EXISTS (
      SELECT 1 FROM ledger_posting p
      WHERE p.transaction_id = t.id AND NOT p.voided AND p.account_id IN (SELECT id FROM tree)
  )
GROUP BY t.id, t.date, t.balancing_currency
ORDER BY t.date, t.id;

-- name: TreeFirstPosting :one
-- The booked date of the earliest non-voided posting of the accounts and their sub-accounts;
-- found is false, and first_on meaningless, when there is none.
WITH RECURSIVE tree AS (
    SELECT a.id FROM ledger_account a WHERE a.user_id = @user_id AND a.id = ANY(@account_ids::uuid[])
    UNION
    SELECT c.id FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT coalesce(min(p.booked_on), DATE '0001-01-01')::date AS first_on, (count(*) > 0)::boolean AS found
FROM ledger_posting p
WHERE p.user_id = @user_id AND NOT p.voided AND p.account_id IN (SELECT id FROM tree);

-- name: OwnCategoryMonthlyTotals :many
-- Budget plan amendment A129: own postings of every category of a class, by month.
SELECT p.account_id, date_trunc('month', p.booked_on)::date AS month, sum(p.weight)::bigint AS total
FROM ledger_posting p
JOIN ledger_account a ON a.id = p.account_id AND a.user_id = p.user_id
WHERE p.user_id = @user_id AND a.account_class = @account_class
  AND NOT p.voided
  AND p.booked_on >= @from_date AND p.booked_on < @to_date
GROUP BY 1, 2;

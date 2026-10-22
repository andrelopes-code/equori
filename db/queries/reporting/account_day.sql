-- name: TreeInstruments :many
WITH RECURSIVE tree AS (
    SELECT a.id, a.instrument FROM ledger_account a WHERE a.user_id = @user_id AND a.id = @account_id
    UNION ALL
    SELECT c.id, c.instrument FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT DISTINCT instrument FROM tree ORDER BY instrument;

-- name: ListAllAccounts :many
SELECT user_id, id FROM ledger_account ORDER BY user_id, id;

-- name: DeleteAccountDaysFrom :exec
DELETE FROM reporting_account_day WHERE account_id = $1 AND date >= $2;

-- name: InsertAccountDaysFrom :exec
INSERT INTO reporting_account_day (user_id, account_id, date, delta_booked, delta_settled, balance_booked, balance_settled, inflow_booked, outflow_booked)
SELECT @user_id::bigint, @account_id::uuid, d.date, d.delta_booked, d.delta_settled,
       base.booked + sum(d.delta_booked) OVER w,
       base.settled + sum(d.delta_settled) OVER w,
       d.inflow, d.outflow
FROM (
    SELECT x.date, sum(x.booked)::bigint AS delta_booked, sum(x.settled)::bigint AS delta_settled,
           coalesce(sum(x.booked) FILTER (WHERE x.booked > 0), 0)::bigint AS inflow,
           coalesce(-sum(x.booked) FILTER (WHERE x.booked < 0), 0)::bigint AS outflow
    FROM (
        SELECT p.booked_on AS date, p.amount AS booked, 0::bigint AS settled
        FROM ledger_posting p
        WHERE p.user_id = @user_id::bigint AND p.account_id = @account_id::uuid AND NOT p.voided AND p.booked_on >= @from_date::date
        UNION ALL
        SELECT coalesce(p.settled_on, p.booked_on), 0::bigint, p.amount
        FROM ledger_posting p
        WHERE p.user_id = @user_id::bigint AND p.account_id = @account_id::uuid AND NOT p.voided
          AND coalesce(p.settled_on, p.booked_on) >= @from_date::date
    ) x
    GROUP BY x.date
    HAVING sum(x.booked) <> 0 OR sum(x.settled) <> 0 OR bool_or(x.booked <> 0)
) d
CROSS JOIN (
    SELECT coalesce(sum(p.amount) FILTER (WHERE p.booked_on < @from_date::date), 0)::bigint AS booked,
           coalesce(sum(p.amount) FILTER (WHERE coalesce(p.settled_on, p.booked_on) < @from_date::date), 0)::bigint AS settled
    FROM ledger_posting p
    WHERE p.user_id = @user_id::bigint AND p.account_id = @account_id::uuid AND NOT p.voided
) base
WINDOW w AS (ORDER BY d.date);

-- name: TreeDailyDeltas :many
WITH RECURSIVE tree AS (
    SELECT a.id FROM ledger_account a WHERE a.user_id = @user_id AND a.id = @account_id
    UNION ALL
    SELECT c.id FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id
)
SELECT r.date, sum(r.delta_booked)::bigint AS delta_booked, sum(r.delta_settled)::bigint AS delta_settled
FROM reporting_account_day r
WHERE r.account_id IN (SELECT id FROM tree) AND r.date <= @to_date
GROUP BY r.date
ORDER BY r.date;

-- name: AccountInstrument :one
SELECT instrument FROM ledger_account WHERE user_id = @user_id AND id = @account_id;

-- name: AccountFlows :many
-- A119: the booked inflow and outflow of the account itself, one row per day with a posting.
SELECT r.date, r.inflow_booked, r.outflow_booked
FROM reporting_account_day r
WHERE r.user_id = @user_id AND r.account_id = @account_id AND r.date BETWEEN @from_date::date AND @to_date::date
  AND (r.inflow_booked <> 0 OR r.outflow_booked <> 0)
ORDER BY r.date;

-- name: CategoryTotals :many
-- A77: every account of the class with the sum of its booked deltas in [from, to].
SELECT a.id, a.parent_id, a.name, a.instrument, a.closed_on, coalesce(sum(r.delta_booked), 0)::bigint AS total
FROM ledger_account a
LEFT JOIN reporting_account_day r ON r.account_id = a.id AND r.date BETWEEN @from_date::date AND @to_date::date
WHERE a.user_id = @user_id AND a.account_class = @account_class
GROUP BY a.id
ORDER BY a.name, a.id;

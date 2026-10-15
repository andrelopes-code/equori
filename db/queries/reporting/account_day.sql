-- name: AccountCurrency :one
SELECT instrument FROM ledger_account WHERE user_id = $1 AND id = $2;

-- name: ListAllAccounts :many
SELECT user_id, id FROM ledger_account ORDER BY user_id, id;

-- name: DeleteAccountDaysFrom :exec
DELETE FROM reporting_account_day WHERE account_id = $1 AND date >= $2;

-- name: InsertAccountDaysFrom :exec
INSERT INTO reporting_account_day (user_id, account_id, date, delta_booked, delta_settled, balance_booked, balance_settled)
SELECT @user_id::bigint, @account_id::uuid, d.date, d.delta_booked, d.delta_settled,
       base.booked + sum(d.delta_booked) OVER w,
       base.settled + sum(d.delta_settled) OVER w
FROM (
    SELECT x.date, sum(x.booked)::bigint AS delta_booked, sum(x.settled)::bigint AS delta_settled
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
    HAVING sum(x.booked) <> 0 OR sum(x.settled) <> 0
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

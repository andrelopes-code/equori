-- +goose Up
-- A119: booked inflow and outflow per account and day. The projection is rebuilt from
-- ledger_posting, as InsertAccountDaysFrom does from the first day, so every row satisfies
-- the checks and days whose net delta is zero gain a row.
DELETE FROM reporting_account_day;

ALTER TABLE reporting_account_day
    ADD COLUMN inflow_booked  bigint NOT NULL,
    ADD COLUMN outflow_booked bigint NOT NULL,
    ADD CONSTRAINT reporting_account_day_flows_check CHECK (inflow_booked >= 0 AND outflow_booked >= 0),
    ADD CONSTRAINT reporting_account_day_delta_check CHECK (inflow_booked - outflow_booked = delta_booked);

INSERT INTO reporting_account_day (user_id, account_id, date, delta_booked, delta_settled, balance_booked, balance_settled, inflow_booked, outflow_booked)
SELECT d.user_id, d.account_id, d.date, d.delta_booked, d.delta_settled,
       sum(d.delta_booked) OVER w, sum(d.delta_settled) OVER w, d.inflow, d.outflow
FROM (
    SELECT x.user_id, x.account_id, x.date,
           sum(x.booked)::bigint AS delta_booked, sum(x.settled)::bigint AS delta_settled,
           coalesce(sum(x.booked) FILTER (WHERE x.booked > 0), 0)::bigint AS inflow,
           coalesce(-sum(x.booked) FILTER (WHERE x.booked < 0), 0)::bigint AS outflow
    FROM (
        SELECT p.user_id, p.account_id, p.booked_on AS date, p.amount AS booked, 0::bigint AS settled
        FROM ledger_posting p WHERE NOT p.voided
        UNION ALL
        SELECT p.user_id, p.account_id, coalesce(p.settled_on, p.booked_on), 0::bigint, p.amount
        FROM ledger_posting p WHERE NOT p.voided
    ) x
    GROUP BY x.user_id, x.account_id, x.date
    HAVING sum(x.booked) <> 0 OR sum(x.settled) <> 0 OR bool_or(x.booked <> 0)
) d
WINDOW w AS (PARTITION BY d.account_id ORDER BY d.date);

-- +goose Down
DELETE FROM reporting_account_day WHERE delta_booked = 0 AND delta_settled = 0;
ALTER TABLE reporting_account_day
    DROP CONSTRAINT reporting_account_day_delta_check,
    DROP CONSTRAINT reporting_account_day_flows_check,
    DROP COLUMN outflow_booked,
    DROP COLUMN inflow_booked;

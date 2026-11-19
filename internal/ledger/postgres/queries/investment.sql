-- name: InsertTrade :exec
INSERT INTO
    ledger_trade (
        transaction_id,
        books_id,
        account_id,
        cash_account_id,
        side,
        quantity,
        unit_price,
        gross,
        fees,
        taxes,
        cost,
        day_trade_quantity,
        day_trade_cost,
        currency
    )
VALUES
    (
        @transaction_id,
        @books_id,
        @account_id,
        @cash_account_id,
        @side,
        @quantity,
        @unit_price,
        @gross,
        @fees,
        @taxes,
        sqlc.narg (cost),
        @day_trade_quantity,
        @day_trade_cost,
        @currency
    );

-- name: ListTrades :many
SELECT
    *
FROM
    ledger_trade
WHERE
    books_id = @books_id
    AND transaction_id = ANY (@transaction_ids::UUID[]);

-- name: DeleteTrade :exec
DELETE FROM ledger_trade
WHERE
    books_id = @books_id
    AND transaction_id = @transaction_id;

-- name: Holding :one
-- The quantity and cost basis of a security account at the end of a date (P8 amendment A68),
-- without the postings of the transaction exclude (A227 IC6).
SELECT
    coalesce(sum(amount), 0)::bigint AS quantity,
    coalesce(sum(weight), 0)::bigint AS cost_basis
FROM
    ledger_posting
WHERE
    books_id = @books_id
    AND account_id = @account_id
    AND NOT voided
    AND booked_on <= @on_date
    AND transaction_id <> @exclude;

-- name: DayTrades :many
-- The non-voided trades of a security account on a date in recording order, without the
-- transaction exclude (A228 IO11).
SELECT
    tr.side,
    tr.quantity,
    tr.gross,
    tr.fees,
    tr.day_trade_quantity
FROM
    ledger_trade tr
    JOIN ledger_transaction t ON t.books_id = tr.books_id
    AND t.id = tr.transaction_id
WHERE
    tr.books_id = @books_id
    AND tr.account_id = @account_id
    AND t.voided_at IS NULL
    AND t.date = @on_date
    AND tr.transaction_id <> @exclude
ORDER BY
    tr.transaction_id;

-- name: LaterSaleExists :one
-- P8 amendment A69, relaxed by A228 IO16: a non-voided sale or write-off (listed options W2: it
-- fixes the cost it removes) of one of the accounts dated after on_date, or on it when same_day.
SELECT
    EXISTS (
        SELECT
            1
        FROM
            ledger_trade tr
            JOIN ledger_transaction t ON t.books_id = tr.books_id
            AND t.id = tr.transaction_id
        WHERE
            tr.books_id = @books_id
            AND tr.account_id = ANY (@account_ids::UUID[])
            AND tr.side IN ('sell', 'write_off')
            AND t.voided_at IS NULL
            AND (
                t.date > @on_date
                OR (
                    @same_day::boolean
                    AND t.date = @on_date
                )
            )
            AND tr.transaction_id <> @exclude
    );

-- name: DeleteInvestmentIncome :exec
DELETE FROM ledger_investment_income
WHERE
    books_id = @books_id
    AND transaction_id = @transaction_id;

-- name: InsertInvestmentIncome :exec
INSERT INTO
    ledger_investment_income (
        transaction_id,
        books_id,
        account_id,
        cash_account_id,
        income_type,
        gross,
        withheld,
        currency
    )
VALUES
    (
        @transaction_id,
        @books_id,
        @account_id,
        @cash_account_id,
        @income_type,
        @gross,
        @withheld,
        @currency
    );

-- name: ListInvestmentIncome :many
SELECT
    *
FROM
    ledger_investment_income
WHERE
    books_id = @books_id
    AND transaction_id = ANY (@transaction_ids::UUID[]);

-- name: SecurityPostings :many
SELECT
    p.account_id,
    p.transaction_id,
    p.booked_on,
    p.amount,
    p.weight
FROM
    ledger_posting p
WHERE
    p.books_id = @books_id
    AND p.account_id = ANY (@account_ids::UUID[])
    AND NOT p.voided
ORDER BY
    p.booked_on,
    p.transaction_id,
    p.position;

-- name: SecurityTrades :many
SELECT
    tr.transaction_id,
    tr.account_id,
    t.date,
    tr.side,
    tr.quantity,
    tr.gross,
    tr.fees,
    tr.taxes,
    tr.cost,
    tr.day_trade_quantity,
    tr.day_trade_cost
FROM
    ledger_trade tr
    JOIN ledger_transaction t ON t.books_id = tr.books_id
    AND t.id = tr.transaction_id
WHERE
    tr.books_id = @books_id
    AND tr.account_id = ANY (@account_ids::UUID[])
    AND t.voided_at IS NULL
ORDER BY
    t.date,
    tr.transaction_id;

-- name: SecurityIncomes :many
-- Income events of the accounts: recorded incomes, and bonuses with a value as bonus_shares
-- (A228 IO28).
SELECT
    i.transaction_id,
    i.account_id,
    t.date,
    i.income_type,
    i.gross,
    i.withheld
FROM
    ledger_investment_income i
    JOIN ledger_transaction t ON t.books_id = i.books_id
    AND t.id = i.transaction_id
WHERE
    i.books_id = @books_id
    AND i.account_id = ANY (@account_ids::UUID[])
    AND t.voided_at IS NULL
UNION ALL
SELECT
    c.transaction_id,
    c.account_id,
    t.date,
    'bonus_shares' AS income_type,
    c.value AS gross,
    0::bigint AS withheld
FROM
    ledger_corporate_action c
    JOIN ledger_transaction t ON t.books_id = c.books_id
    AND t.id = c.transaction_id
WHERE
    c.books_id = @books_id
    AND c.account_id = ANY (@account_ids::UUID[])
    AND t.voided_at IS NULL
    AND c.kind = 'bonus'
    AND c.value > 0
ORDER BY
    date,
    transaction_id;

-- name: InsertCorporateAction :exec
INSERT INTO
    ledger_corporate_action (
        transaction_id,
        books_id,
        account_id,
        kind,
        ratio_from,
        ratio_to,
        held,
        received,
        fraction_remainder,
        unit_cost,
        value,
        new_account_id,
        cost_bp
    )
VALUES
    (
        @transaction_id,
        @books_id,
        @account_id,
        @kind,
        @ratio_from,
        @ratio_to,
        @held,
        @received,
        @fraction_remainder,
        @unit_cost,
        @value,
        sqlc.narg (new_account_id),
        sqlc.narg (cost_bp)
    );

-- name: ListCorporateActions :many
SELECT
    *
FROM
    ledger_corporate_action
WHERE
    books_id = @books_id
    AND transaction_id = ANY (@transaction_ids::UUID[]);

-- name: OpenLotPostings :many
-- The non-voided postings of a security account up to the end of a date, in the order a holding
-- is built, without the transaction exclude; when before_tx is set, the postings of that date
-- recorded before it. A posting that adds units and has a sibling of the same instrument that
-- removes them in its transaction is a custody transfer in; the sibling's account is the source
-- (fixed income lots, FL3 and FL4); the nil UUID means no source.
SELECT
    p.transaction_id,
    p.booked_on,
    p.amount,
    p.weight,
    coalesce(src.account_id, '00000000-0000-0000-0000-000000000000'::uuid) AS source_account_id
FROM
    ledger_posting p
    JOIN ledger_account a ON a.books_id = p.books_id
    AND a.id = p.account_id
    LEFT JOIN LATERAL (
        SELECT
            sp.account_id
        FROM
            ledger_posting sp
            JOIN ledger_account sa ON sa.books_id = sp.books_id
            AND sa.id = sp.account_id
        WHERE
            sp.books_id = p.books_id
            AND sp.transaction_id = p.transaction_id
            AND sp.account_id <> p.account_id
            AND sp.amount < 0
            AND p.amount > 0
            AND sa.instrument = a.instrument
        LIMIT
            1
    ) src ON TRUE
WHERE
    p.books_id = @books_id
    AND p.account_id = @account_id
    AND NOT p.voided
    AND p.booked_on <= @on_date
    AND p.transaction_id <> @exclude
    AND (
        sqlc.narg ('before_tx')::uuid IS NULL
        OR p.booked_on < @on_date
        OR p.transaction_id < sqlc.narg ('before_tx')::uuid
    )
ORDER BY
    p.booked_on,
    p.transaction_id,
    p.position;

-- name: FirstBuyOfAccount :one
SELECT
    t.transaction_id
FROM
    ledger_trade t
    JOIN ledger_transaction x ON x.id = t.transaction_id
WHERE
    t.books_id = @books_id
    AND t.account_id = @account_id
    AND t.side = 'buy'
    AND x.voided_at IS NULL
ORDER BY
    x.date,
    x.id
LIMIT
    1;

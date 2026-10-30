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

-- name: Holding :one
-- The quantity and cost basis of a security account at the end of a date (P8 amendment A68).
SELECT
    coalesce(sum(amount), 0)::bigint AS quantity,
    coalesce(sum(weight), 0)::bigint AS cost_basis
FROM
    ledger_posting
WHERE
    books_id = @books_id
    AND account_id = @account_id
    AND NOT voided
    AND booked_on <= @on_date;

-- name: LaterSaleExists :one
-- P8 amendment A69: a non-voided sale of one of the accounts dated on or after on_date.
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
            AND tr.side = 'sell'
            AND t.voided_at IS NULL
            AND t.date >= @on_date
            AND tr.transaction_id <> @exclude
    );

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
    tr.cost
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
ORDER BY
    t.date,
    i.transaction_id;

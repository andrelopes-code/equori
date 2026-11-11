-- name: DeleteIncomeEvents :exec
DELETE FROM portfolio_income_event
WHERE
    books_id = @books_id
    AND account_id = ANY (@account_ids::UUID[]);

-- name: InsertIncomeEvent :exec
INSERT INTO
    portfolio_income_event (
        books_id,
        transaction_id,
        account_id,
        instrument,
        date,
        income_type,
        tax_treatment,
        gross,
        withheld,
        currency
    )
VALUES
    (
        @books_id,
        @transaction_id,
        @account_id,
        @instrument,
        @date,
        @income_type,
        @tax_treatment,
        @gross,
        @withheld,
        @currency
    );

-- name: ListIncomeEvents :many
SELECT
    *
FROM
    portfolio_income_event
WHERE
    books_id = @books_id
    AND date >= @from_date
    AND date < @to_date
ORDER BY
    date,
    transaction_id;

-- name: ListRebuildBooks :many
SELECT
    books_id
FROM
    ledger_account
WHERE
    kind = 'brokerage'
UNION
SELECT
    books_id
FROM
    portfolio_position_day
UNION
SELECT
    books_id
FROM
    portfolio_realized_result
UNION
SELECT
    books_id
FROM
    portfolio_income_event
ORDER BY
    books_id;

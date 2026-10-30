-- name: IndicatorBaseCurrency :one
SELECT
    base_currency
FROM
    ledger_settings
WHERE
    books_id = @books_id;

-- name: IndicatorFirstPosting :one
-- The earliest booked date of the user's postings that are not voided.
SELECT
    booked_on
FROM
    ledger_posting
WHERE
    books_id = @books_id
    AND NOT voided
ORDER BY
    booked_on
LIMIT
    1;

-- name: IndicatorAccounts :many
-- Every account of the user; interest marks the system category interest and its descendants.
WITH RECURSIVE
    interest AS (
        SELECT
            r.id
        FROM
            ledger_account r
        WHERE
            r.books_id = @books_id
            AND r.system_role = 'interest'
        UNION ALL
        SELECT
            a.id
        FROM
            ledger_account a
            JOIN interest i ON a.parent_id = i.id
        WHERE
            a.books_id = @books_id
    )
SELECT
    a.id,
    a.account_class,
    coalesce(a.kind, '')::text AS kind,
    a.instrument,
    a.excluded_from_liquidity,
    (
        a.id IN (
            SELECT
                id
            FROM
                interest
        )
    )::boolean AS interest
FROM
    ledger_account a
WHERE
    a.books_id = @books_id;

-- name: LoanPrincipalByMonth :many
-- Analytics design 4.2: postings that reduce a loan owed in the base currency, paid from an asset account.
SELECT
    date_trunc('month', p.booked_on)::date AS MONTH,
    sum(p.amount)::bigint AS total
FROM
    ledger_posting p
    JOIN ledger_account a ON a.id = p.account_id
    JOIN ledger_settings st ON st.books_id = p.books_id
WHERE
    p.books_id = @books_id
    AND NOT p.voided
    AND a.account_class = 'liability'
    AND a.kind = 'loan'
    AND a.instrument = st.base_currency
    AND p.amount > 0
    AND p.booked_on BETWEEN @from_date::date AND @to_date::date
    AND EXISTS (
        SELECT
            1
        FROM
            ledger_posting q
            JOIN ledger_account qa ON qa.id = q.account_id
        WHERE
            q.books_id = p.books_id
            AND q.transaction_id = p.transaction_id
            AND NOT q.voided
            AND qa.account_class = 'asset'
    )
GROUP BY
    1;

-- name: UpsertIndexRate :exec
INSERT INTO
    marketdata_index_rate (index_id, date, rate, source)
VALUES
    (@index_id, @date, @rate, @source)
ON CONFLICT (index_id, date) DO UPDATE
SET
    rate = EXCLUDED.rate,
    source = EXCLUDED.source;

-- name: EarliestIndexRate :one
-- found is false, and earliest meaningless, when the index has no rate.
SELECT
    coalesce(min(date), DATE '0001-01-01')::date AS earliest,
    (count(*) > 0)::boolean AS found
FROM
    marketdata_index_rate
WHERE
    index_id = @index_id;

-- name: LatestIndexRate :one
-- found is false, and latest meaningless, when the index has no rate.
SELECT
    coalesce(max(date), DATE '0001-01-01')::date AS latest,
    (count(*) > 0)::boolean AS found
FROM
    marketdata_index_rate
WHERE
    index_id = @index_id;

-- name: IndexTermsStart :one
-- The earliest issue date among the terms that follow the index; n is their number.
SELECT
    coalesce(min(issued_on), DATE '0001-01-01')::date AS issued_on,
    count(*) AS n
FROM
    marketdata_fixed_income_terms
WHERE
    index_id = @index_id;

-- name: ListIndexRates :many
SELECT
    date,
    rate
FROM
    marketdata_index_rate
WHERE
    index_id = @index_id
    AND date >= @from_date
ORDER BY
    date;

-- name: IndexRange :one
-- n is 0, and first and last meaningless, when the index has no rate.
SELECT
    coalesce(min(date), DATE '0001-01-01')::date AS first,
    coalesce(max(date), DATE '0001-01-01')::date AS last,
    count(*) AS n
FROM
    marketdata_index_rate
WHERE
    index_id = @index_id;

-- name: ListIndexRatesBetween :many
SELECT
    date,
    rate
FROM
    marketdata_index_rate
WHERE
    index_id = @index_id
    AND date >= @from_date
    AND date <= @to_date
ORDER BY
    date;

-- name: IndexCheck :many
-- The last whole read of the index, no row when it was never read whole (A265 RI1).
SELECT
    *
FROM
    marketdata_index_check
WHERE
    index_id = @index_id;

-- name: ListIndexChecks :many
SELECT
    *
FROM
    marketdata_index_check;

-- name: SetIndexCheck :exec
INSERT INTO
    marketdata_index_check (index_id, from_date, checked_on, missing)
VALUES
    (@index_id, @from_date, @checked_on, @missing)
ON CONFLICT (index_id) DO UPDATE
SET
    from_date = EXCLUDED.from_date,
    checked_on = EXCLUDED.checked_on,
    missing = EXCLUDED.missing;

-- name: SetIndexMissing :exec
UPDATE marketdata_index_check
SET
    missing = @missing
WHERE
    index_id = @index_id;

-- name: DeleteAccruedOfIndex :exec
-- Deletes the prices of @source dated on or after from_date of each security that follows the
-- index: an accrual over a rate written before the latest one is computed again (A265 RI2).
DELETE FROM marketdata_price p USING marketdata_fixed_income_terms t
WHERE
    t.index_id = @index_id
    AND p.instrument = t.instrument_code
    AND p.source = @source
    AND p.date >= @from_date;

-- name: ListIndexDates :many
SELECT
    date
FROM
    marketdata_index_rate
WHERE
    index_id = @index_id
ORDER BY
    date;

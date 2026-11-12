-- name: UpsertPrice :exec
INSERT INTO
    marketdata_price (instrument, quote_instrument, date, value, source, priority)
VALUES
    (@instrument, @quote_instrument, @date, @value, @source, @priority)
ON CONFLICT (instrument, quote_instrument, date, source) DO UPDATE
SET
    value = EXCLUDED.value,
    recorded_at = now();

-- name: PriceOnOrBefore :many
SELECT
    *
FROM
    marketdata_price
WHERE
    instrument = @instrument
    AND quote_instrument = @quote_instrument
    AND date <= @date
ORDER BY
    date DESC,
    priority,
    recorded_at DESC
LIMIT
    1;

-- name: ListChosenPrices :many
SELECT DISTINCT
    ON (date) *
FROM
    marketdata_price
WHERE
    instrument = @instrument
    AND quote_instrument = @quote_instrument
    AND date BETWEEN @from_date AND @to_date
ORDER BY
    date,
    priority,
    recorded_at DESC;

-- name: LatestSourceDate :one
SELECT
    coalesce(max(date), DATE '1970-01-01')::date AS latest
FROM
    marketdata_price
WHERE
    source = @source
    AND (
        sqlc.narg (instrument)::text IS NULL
        OR instrument = sqlc.narg (instrument)
    );

-- name: ConversionIntermediate :one
WITH
    legs AS (
        SELECT
            quote_instrument AS other,
            instrument AS side,
            max(date) AS latest
        FROM
            marketdata_price
        WHERE
            instrument IN (@from_code::text, @to_code::text)
            AND marketdata_price.date <= @date
        GROUP BY
            1,
            2
        UNION ALL
        SELECT
            instrument,
            quote_instrument,
            max(date)
        FROM
            marketdata_price
        WHERE
            quote_instrument IN (@from_code::text, @to_code::text)
            AND marketdata_price.date <= @date
        GROUP BY
            1,
            2
    ),
    best AS (
        SELECT
            other,
            side,
            max(latest) AS latest
        FROM
            legs
        GROUP BY
            other,
            side
    )
SELECT
    f.other::text AS code
FROM
    best f
    JOIN best t ON t.other = f.other
    AND t.side = @to_code::text
WHERE
    f.side = @from_code::text
    AND f.other NOT IN (@from_code::text, @to_code::text)
ORDER BY
    least(f.latest, t.latest) DESC,
    f.other
LIMIT
    1;

-- name: DeletePricesBySource :exec
DELETE FROM marketdata_price
WHERE
    source = @source
    AND instrument = @instrument;

-- name: EarliestSourceDate :one
SELECT
    coalesce(min(date), DATE '9999-12-31')::date AS earliest
FROM
    marketdata_price
WHERE
    source = @source
    AND (
        instrument = @instrument
        OR quote_instrument = @instrument
    );

-- name: InstrumentCoverage :one
SELECT
    coalesce(min(date), DATE '1970-01-01')::date AS first,
    coalesce(max(date), DATE '1970-01-01')::date AS last,
    count(DISTINCT date)::int AS days
FROM
    marketdata_price
WHERE
    instrument = @instrument
    AND (
        sqlc.narg (quote_instrument)::text IS NULL
        OR quote_instrument = sqlc.narg (quote_instrument)
    );

-- name: SourceCoverage :many
SELECT
    source,
    min(date)::date AS first,
    max(date)::date AS last
FROM
    marketdata_price
WHERE
    instrument = @instrument
    OR quote_instrument = @instrument
GROUP BY
    source
ORDER BY
    source;

-- name: ListPricesOnDates :many
SELECT
    date,
    source,
    value
FROM
    marketdata_price
WHERE
    instrument = @instrument
    AND quote_instrument = @quote_instrument
    AND date = ANY (@dates::date[])
ORDER BY
    date,
    source;

-- name: ListQuotePrices :many
-- The chosen price on or before each reference date of each instrument and quote pair (IQ3). The
-- pairs are the arrays @instruments and @quotes read by position; the result names a date by its
-- position in @dates, counted from 1. A pair with no price on or before a date gives no row.
SELECT
    pair.instrument::text AS instrument,
    pair.quote::text AS quote_instrument,
    ref.position::int AS position,
    price.date::date AS date,
    price.value::numeric AS value
FROM
    (
        SELECT
            i.instrument,
            q.quote
        FROM
            unnest(@instruments::TEXT[]) WITH ORDINALITY AS i (instrument, n)
            JOIN unnest(@quotes::TEXT[]) WITH ORDINALITY AS q (quote, n) USING (n)
    ) AS pair
    CROSS JOIN unnest(@dates::date[]) WITH ORDINALITY AS ref (DAY, position)
    CROSS JOIN LATERAL (
        SELECT
            p.date,
            p.value
        FROM
            marketdata_price p
        WHERE
            p.instrument = pair.instrument
            AND p.quote_instrument = pair.quote
            AND p.date <= ref.day
        ORDER BY
            p.date DESC,
            p.priority,
            p.recorded_at DESC
        LIMIT
            1
    ) AS price;

-- name: ListQuoteReferences :many
-- The chosen price on or before each day of each row. A row is the instrument, quote, position and
-- day at the same index of the four arrays; the result repeats the position it was asked for.
SELECT
    ref.instrument::text AS instrument,
    ref.quote::text AS quote_instrument,
    ref.position::int AS position,
    price.date::date AS date,
    price.value::numeric AS value
FROM
    (
        SELECT
            i.instrument,
            q.quote,
            p.position,
            d.day
        FROM
            unnest(@instruments::TEXT[]) WITH ORDINALITY AS i (instrument, n)
            JOIN unnest(@quotes::TEXT[]) WITH ORDINALITY AS q (quote, n) USING (n)
            JOIN unnest(@positions::INT[]) WITH ORDINALITY AS p (position, n) USING (n)
            JOIN unnest(@days::date[]) WITH ORDINALITY AS d (DAY, n) USING (n)
    ) AS ref
    CROSS JOIN LATERAL (
        SELECT
            p.date,
            p.value
        FROM
            marketdata_price p
        WHERE
            p.instrument = ref.instrument
            AND p.quote_instrument = ref.quote
            AND p.date <= ref.day
        ORDER BY
            p.date DESC,
            p.priority,
            p.recorded_at DESC
        LIMIT
            1
    ) AS price;

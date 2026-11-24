-- name: ListPriceHoles :many
-- The sessions of the index between the first and the last price of the pair, up to until, that
-- have no price and were not asked for (A265 PH3). A typed or computed price does not extend the
-- range: no source quotes it.
WITH
    quoted AS (
        SELECT
            min(date) AS first,
            max(date) AS last
        FROM
            marketdata_price
        WHERE
            instrument = @instrument
            AND quote_instrument = @quote_instrument
            AND source NOT IN ('manual', 'csv', 'accrual')
    )
SELECT
    r.date
FROM
    marketdata_index_rate r
    CROSS JOIN quoted
WHERE
    r.index_id = @index_id
    AND r.date > quoted.first
    AND r.date < quoted.last
    AND r.date <= @until
    AND NOT EXISTS (
        SELECT
            1
        FROM
            marketdata_price p
        WHERE
            p.instrument = @instrument
            AND p.quote_instrument = @quote_instrument
            AND p.date = r.date
    )
    AND NOT EXISTS (
        SELECT
            1
        FROM
            marketdata_price_hole h
        WHERE
            h.instrument = @instrument
            AND h.quote_instrument = @quote_instrument
            AND h.date = r.date
    )
ORDER BY
    r.date;

-- name: ListPairSources :many
SELECT DISTINCT
    source
FROM
    marketdata_price
WHERE
    instrument = @instrument
    AND quote_instrument = @quote_instrument
ORDER BY
    source;

-- name: RecordPriceHole :exec
INSERT INTO
    marketdata_price_hole (instrument, quote_instrument, date, no_trade)
VALUES
    (@instrument, @quote_instrument, @date, @no_trade)
ON CONFLICT DO NOTHING;

-- name: CountPriceHoles :one
-- The recorded holes of the pair that still have no price, the sessions without a trade left out.
SELECT
    count(*)::int
FROM
    marketdata_price_hole h
WHERE
    h.instrument = @instrument
    AND h.quote_instrument = @quote_instrument
    AND NOT h.no_trade
    AND NOT EXISTS (
        SELECT
            1
        FROM
            marketdata_price p
        WHERE
            p.instrument = h.instrument
            AND p.quote_instrument = h.quote_instrument
            AND p.date = h.date
    );

-- name: DeletePriceHoles :exec
DELETE FROM marketdata_price_hole;

-- name: CountFreshHistory :one
-- The history requests of the sources that no tick ran yet.
SELECT
    count(*)::int
FROM
    marketdata_history
WHERE
    source = ANY (@sources::TEXT[])
    AND done_at IS NULL
    AND error IS NULL;

-- name: FirstQuotedDate :one
-- The date of the first price a source quoted of the instrument, 1970-01-01 without one.
SELECT
    coalesce(min(date), DATE '1970-01-01')::date AS first
FROM
    marketdata_price
WHERE
    instrument = @instrument
    AND source NOT IN ('manual', 'csv', 'accrual');

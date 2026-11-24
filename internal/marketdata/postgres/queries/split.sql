-- name: ListSplits :many
SELECT
    *
FROM
    marketdata_split
ORDER BY
    instrument,
    date;

-- name: ListInstrumentSplits :many
SELECT
    *
FROM
    marketdata_split
WHERE
    instrument = @instrument
ORDER BY
    date;

-- name: StoreSplit :exec
INSERT INTO
    marketdata_split (instrument, date, ratio, source)
VALUES
    (@instrument, @date, @ratio, @source)
ON CONFLICT DO NOTHING;

-- name: FirstPriceFrom :many
-- The chosen price of the first date in [from_date, to_date] of the instrument against its quote.
SELECT
    *
FROM
    marketdata_price
WHERE
    instrument = @instrument
    AND quote_instrument = @quote_instrument
    AND date BETWEEN @from_date AND @to_date
ORDER BY
    date,
    priority,
    recorded_at DESC
LIMIT
    1;

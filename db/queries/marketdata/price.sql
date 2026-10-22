-- name: UpsertPrice :exec
INSERT INTO marketdata_price (instrument, quote_instrument, date, value, source, priority)
VALUES (@instrument, @quote_instrument, @date, @value, @source, @priority)
ON CONFLICT (instrument, quote_instrument, date, source)
DO UPDATE SET value = EXCLUDED.value, recorded_at = now();

-- name: PriceOnOrBefore :many
SELECT * FROM marketdata_price
WHERE instrument = @instrument AND quote_instrument = @quote_instrument AND date <= @date
ORDER BY date DESC, priority, recorded_at DESC
LIMIT 1;

-- name: ListChosenPrices :many
SELECT DISTINCT ON (date) * FROM marketdata_price
WHERE instrument = @instrument AND quote_instrument = @quote_instrument
  AND date BETWEEN @from_date AND @to_date
ORDER BY date, priority, recorded_at DESC;

-- name: LatestSourceDate :one
SELECT coalesce(max(date), DATE '1970-01-01')::date AS latest FROM marketdata_price
WHERE source = @source AND (sqlc.narg(instrument)::text IS NULL OR instrument = sqlc.narg(instrument));

-- name: ConversionIntermediate :one
WITH legs AS (
    SELECT quote_instrument AS other, instrument AS side, max(date) AS latest FROM marketdata_price
    WHERE instrument IN (@from_code::text, @to_code::text) AND marketdata_price.date <= @date GROUP BY 1, 2
    UNION ALL
    SELECT instrument, quote_instrument, max(date) FROM marketdata_price
    WHERE quote_instrument IN (@from_code::text, @to_code::text) AND marketdata_price.date <= @date GROUP BY 1, 2
), best AS (
    SELECT other, side, max(latest) AS latest FROM legs GROUP BY other, side
)
SELECT f.other::text AS code FROM best f
JOIN best t ON t.other = f.other AND t.side = @to_code::text
WHERE f.side = @from_code::text AND f.other NOT IN (@from_code::text, @to_code::text)
ORDER BY least(f.latest, t.latest) DESC, f.other
LIMIT 1;

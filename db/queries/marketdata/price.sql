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

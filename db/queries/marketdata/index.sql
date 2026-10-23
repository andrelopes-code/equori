-- name: UpsertIndexRate :exec
INSERT INTO marketdata_index_rate (index_id, date, rate, source) VALUES (@index_id, @date, @rate, @source)
ON CONFLICT (index_id, date) DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source;

-- name: LatestIndexRate :one
-- found is false, and latest meaningless, when the index has no rate.
SELECT coalesce(max(date), DATE '0001-01-01')::date AS latest, (count(*) > 0)::boolean AS found
FROM marketdata_index_rate WHERE index_id = @index_id;

-- name: IndexTermsStart :one
-- The earliest issue date among the terms that follow the index; n is their number.
SELECT coalesce(min(issued_on), DATE '0001-01-01')::date AS issued_on, count(*) AS n
FROM marketdata_fixed_income_terms WHERE index_id = @index_id;

-- name: ListIndexRates :many
SELECT date, rate FROM marketdata_index_rate WHERE index_id = @index_id AND date >= @from_date ORDER BY date;

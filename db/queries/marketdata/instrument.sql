-- name: GetInstrument :one
SELECT * FROM marketdata_instrument WHERE code = $1;

-- name: ListInstrumentsByType :many
SELECT * FROM marketdata_instrument WHERE instrument_type = $1 ORDER BY code;

-- name: ListInstruments :many
SELECT * FROM marketdata_instrument ORDER BY code;

-- name: InsertInstrument :execrows
INSERT INTO marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange)
VALUES (@code, @instrument_type, @scale, @name, @quote_currency, sqlc.narg(exchange))
ON CONFLICT (code) DO NOTHING;

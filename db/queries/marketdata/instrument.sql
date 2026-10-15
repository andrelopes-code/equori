-- name: GetInstrument :one
SELECT * FROM marketdata_instrument WHERE code = $1;

-- name: ListInstrumentsByType :many
SELECT * FROM marketdata_instrument WHERE instrument_type = $1 ORDER BY code;

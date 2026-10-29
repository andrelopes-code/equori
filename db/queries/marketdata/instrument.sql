-- name: GetInstrument :one
SELECT
    *
FROM
    marketdata_instrument
WHERE
    code = $1;

-- name: ListInstrumentsByType :many
SELECT
    *
FROM
    marketdata_instrument
WHERE
    instrument_type = $1
ORDER BY
    code;

-- name: ListInstruments :many
SELECT
    *
FROM
    marketdata_instrument
ORDER BY
    code;

-- name: InsertInstrument :execrows
INSERT INTO
    marketdata_instrument (code, instrument_type, scale, name, quote_currency, exchange, subtype)
VALUES
    (
        @code,
        @instrument_type,
        @scale,
        @name,
        @quote_currency,
        sqlc.narg (exchange),
        sqlc.narg (subtype)
    )
ON CONFLICT (code) DO NOTHING;

-- name: UpdateInstrument :execrows
UPDATE marketdata_instrument
SET
    name = @name,
    exchange = sqlc.narg (exchange),
    subtype = sqlc.narg (subtype)
WHERE
    code = @code;

-- name: InsertMissingCurrencies :exec
INSERT INTO
    marketdata_instrument (code, instrument_type, scale, name)
SELECT
    unnest(@codes::TEXT[]),
    'currency',
    unnest(@scales::SMALLINT[]),
    unnest(@names::TEXT[])
ON CONFLICT (code) DO NOTHING;

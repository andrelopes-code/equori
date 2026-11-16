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
    marketdata_instrument (
        code,
        instrument_type,
        scale,
        name,
        quote_currency,
        exchange,
        subtype,
        books_id,
        issuer,
        issuer_scheme,
        issuer_id
    )
VALUES
    (
        @code,
        @instrument_type,
        @scale,
        @name,
        @quote_currency,
        sqlc.narg (exchange),
        sqlc.narg (subtype),
        sqlc.narg (books_id),
        sqlc.narg (issuer),
        sqlc.narg (issuer_scheme),
        sqlc.narg (issuer_id)
    )
ON CONFLICT (code) DO NOTHING;

-- name: UpdateInstrument :execrows
UPDATE marketdata_instrument
SET
    instrument_type = @instrument_type,
    name = @name,
    exchange = sqlc.narg (exchange),
    subtype = sqlc.narg (subtype),
    issuer = sqlc.narg (issuer),
    issuer_scheme = sqlc.narg (issuer_scheme),
    issuer_id = sqlc.narg (issuer_id)
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

-- name: DeleteInstrumentPrices :exec
DELETE FROM marketdata_price
WHERE
    instrument = @code;

-- name: DeleteInstrumentTerms :exec
DELETE FROM marketdata_fixed_income_terms
WHERE
    instrument_code = @code;

-- name: DeleteInstrumentHistory :exec
DELETE FROM marketdata_history
WHERE
    instrument = @code;

-- name: DeleteInstrument :execrows
DELETE FROM marketdata_instrument
WHERE
    code = @code;

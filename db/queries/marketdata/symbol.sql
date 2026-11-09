-- name: ListInstrumentSymbols :many
SELECT
    instrument,
    source,
    symbol
FROM
    marketdata_instrument_symbol
ORDER BY
    instrument,
    source;

-- name: DeleteInstrumentSymbols :exec
DELETE FROM marketdata_instrument_symbol
WHERE
    instrument = $1;

-- name: InsertInstrumentSymbol :exec
INSERT INTO
    marketdata_instrument_symbol (instrument, source, symbol)
VALUES
    ($1, $2, $3);

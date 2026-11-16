-- name: ListHiddenInstruments :many
SELECT
    instrument
FROM
    marketdata_instrument_hidden
WHERE
    books_id = $1;

-- name: HideInstrument :exec
INSERT INTO
    marketdata_instrument_hidden (books_id, instrument)
VALUES
    ($1, $2)
ON CONFLICT DO NOTHING;

-- name: ShowInstrument :exec
DELETE FROM marketdata_instrument_hidden
WHERE
    books_id = $1
    AND instrument = $2;

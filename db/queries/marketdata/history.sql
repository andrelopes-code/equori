-- name: RequestHistory :exec
INSERT INTO
    marketdata_history (source, instrument, from_date, requested_at)
VALUES
    (@source, @instrument, @from_date, @requested_at)
ON CONFLICT (source, instrument) DO UPDATE
SET
    from_date = EXCLUDED.from_date,
    requested_at = EXCLUDED.requested_at,
    done_at = NULL,
    error = NULL
WHERE
    EXCLUDED.from_date < marketdata_history.from_date;

-- name: ListPendingHistory :many
SELECT
    *
FROM
    marketdata_history
WHERE
    source = @source
    AND done_at IS NULL
ORDER BY
    instrument;

-- name: FinishHistory :exec
UPDATE marketdata_history
SET
    done_at = sqlc.narg (done_at),
    error = sqlc.narg (error)
WHERE
    source = @source
    AND instrument = @instrument
    AND requested_at = @requested_at;

-- name: ListInstrumentHistory :many
SELECT
    *
FROM
    marketdata_history
WHERE
    instrument = @instrument
ORDER BY
    source;

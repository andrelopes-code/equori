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

-- name: CountPendingHistory :many
SELECT
    source,
    count(*)::int AS pending
FROM
    marketdata_history
WHERE
    done_at IS NULL
GROUP BY
    source
ORDER BY
    source;

-- name: ReopenHistory :exec
-- A finished history whose stored prices hold a hole runs again from from_date (A248 CQ4b).
UPDATE marketdata_history
SET
    from_date = @from_date,
    requested_at = @requested_at,
    done_at = NULL,
    error = NULL
WHERE
    source = @source
    AND instrument = @instrument
    AND done_at IS NOT NULL;

-- name: SourceDatesFrom :many
-- The dates of the stored prices of one source and instrument, as the instrument or as its quote,
-- on or after from_date, oldest first (A248 CQ4b).
SELECT
    date
FROM
    marketdata_price
WHERE
    source = @source
    AND date >= @from_date
    AND (
        instrument = @instrument
        OR quote_instrument = @instrument
    )
GROUP BY
    date
ORDER BY
    date;

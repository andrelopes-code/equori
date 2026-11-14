-- +goose Up
-- A222 MQ18: yahoo_chart repeated the last close on days without a trade (volume 0, flat bar).
-- The volume was not stored, so the rows are found by their effect: 4 or more consecutive closes
-- of one instrument with the same value. Those rows are removed and the history of each affected
-- instrument is queued again from its first removed date; the corrected source refills the dates
-- it kept. Nothing is removed while the source is disabled, because nothing would refill it.
WITH changes AS (
    SELECT
        instrument,
        quote_instrument,
        date,
        (value IS DISTINCT FROM lag(value) OVER w)::int AS changed
    FROM marketdata_price
    WHERE source = 'yahoo_chart'
    WINDOW w AS (PARTITION BY instrument, quote_instrument ORDER BY date)
),
runs AS (
    SELECT
        instrument,
        quote_instrument,
        date,
        sum(changed) OVER (PARTITION BY instrument, quote_instrument ORDER BY date) AS run
    FROM changes
),
repeated AS (
    SELECT instrument, quote_instrument, date
    FROM (
        SELECT *, count(*) OVER (PARTITION BY instrument, quote_instrument, run) AS length
        FROM runs
    ) sized
    WHERE length >= 4
),
purged AS (
    DELETE FROM marketdata_price p
    USING repeated r
    WHERE p.source = 'yahoo_chart'
        AND p.instrument = r.instrument
        AND p.quote_instrument = r.quote_instrument
        AND p.date = r.date
        AND EXISTS (SELECT 1 FROM marketdata_feed WHERE id = 'yahoo_chart' AND enabled)
    RETURNING p.instrument, p.date
)
INSERT INTO marketdata_history (source, instrument, from_date, requested_at)
SELECT 'yahoo_chart', instrument, min(date), now()
FROM purged
GROUP BY instrument
ON CONFLICT (source, instrument) DO UPDATE
SET
    from_date = least(marketdata_history.from_date, EXCLUDED.from_date),
    requested_at = EXCLUDED.requested_at,
    done_at = NULL,
    error = NULL;

-- +goose Down
-- The removed closes were repeats of an earlier close and are not restored.
SELECT 1;

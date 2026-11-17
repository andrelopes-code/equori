-- +goose Up
-- A248 CQ4: a tick stored the running bar of yahoo_chart and coinbase as the close of its day
-- and never fetched it again. Such a row was recorded before its day ended anywhere. The rows of
-- each affected pair are removed from its earliest such date on and the history of the
-- instrument is queued from that date; the corrected source refills them (CQ4a). Nothing is
-- removed while the source is disabled, because nothing would refill it.
WITH firsts AS (
    SELECT p.source, p.instrument, p.quote_instrument, min(p.date) AS first
    FROM marketdata_price p
    WHERE p.source IN ('yahoo_chart', 'coinbase')
        AND p.recorded_at < (p.date + INTERVAL '36 hours') AT TIME ZONE 'UTC'
        AND EXISTS (SELECT 1 FROM marketdata_feed f WHERE f.id = p.source AND f.enabled)
    GROUP BY p.source, p.instrument, p.quote_instrument
),
purged AS (
    DELETE FROM marketdata_price p
    USING firsts f
    WHERE p.source = f.source
        AND p.instrument = f.instrument
        AND p.quote_instrument = f.quote_instrument
        AND p.date >= f.first
    RETURNING p.source, p.instrument, p.date
)
INSERT INTO marketdata_history (source, instrument, from_date, requested_at)
SELECT source, instrument, min(date), now()
FROM purged
GROUP BY source, instrument
ON CONFLICT (source, instrument) DO UPDATE
SET
    from_date = least(marketdata_history.from_date, EXCLUDED.from_date),
    requested_at = EXCLUDED.requested_at,
    done_at = NULL,
    error = NULL;

-- +goose Down
-- The removed rows were values of a running session and are not restored.
SELECT 1;

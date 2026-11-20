-- +goose Up
-- A222 MQ18: yahoo_chart stored the close of a security divided by the ratio of every later
-- split, while the B3 and the ledger keep the close the market printed. The splits were not
-- stored, so every close of a security from that source is removed and its history is queued
-- again from its first removed date; the corrected source refills it unadjusted. A currency or a
-- crypto asset has no split and keeps its closes. Nothing is removed while the source is
-- disabled, because nothing would refill it.
WITH purged AS (
    DELETE FROM marketdata_price p
    USING marketdata_instrument i
    WHERE p.source = 'yahoo_chart'
        AND i.code = p.instrument
        AND i.instrument_type NOT IN ('currency', 'crypto')
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
-- The removed closes were adjusted for later splits and are not restored.
SELECT 1;

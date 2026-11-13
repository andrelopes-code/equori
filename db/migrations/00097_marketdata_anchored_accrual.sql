-- +goose Up
-- Return honesty HR1: an accrued price follows the latest price that outranks it. The accrued
-- prices stored before that rule ignore those prices; deleting them lets the next tick compute the
-- whole series again, anchored. Accrued prices are derived from the terms and the index rates.
DELETE FROM marketdata_price accrued
WHERE
    accrued.source = 'accrual'
    AND EXISTS (
        SELECT
            1
        FROM
            marketdata_price anchor
        WHERE
            anchor.instrument = accrued.instrument
            AND anchor.quote_instrument = accrued.quote_instrument
            AND anchor.priority < accrued.priority
    );

-- +goose Down
-- The deleted prices are derived: the tick computes them again under either rule.
SELECT
    1;

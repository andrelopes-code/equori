-- +goose Up
-- Whether a source that lists every trade of the session states there was none of the instrument
-- (A265 PH5). The holes recorded before are asked again.
ALTER TABLE marketdata_price_hole
    ADD COLUMN no_trade boolean NOT NULL DEFAULT FALSE;

DELETE FROM marketdata_price_hole;

-- +goose Down
ALTER TABLE marketdata_price_hole
    DROP COLUMN no_trade;

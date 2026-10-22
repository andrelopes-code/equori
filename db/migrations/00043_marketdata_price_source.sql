-- +goose Up
ALTER TABLE marketdata_price DROP CONSTRAINT marketdata_price_source_check;
ALTER TABLE marketdata_price ADD CONSTRAINT marketdata_price_source_check CHECK (source ~ '^[a-z0-9_]{2,40}$');

-- +goose Down
ALTER TABLE marketdata_price DROP CONSTRAINT marketdata_price_source_check;
ALTER TABLE marketdata_price ADD CONSTRAINT marketdata_price_source_check CHECK (source IN ('manual', 'csv', 'bcb_ptax', 'b3_cotahist'));

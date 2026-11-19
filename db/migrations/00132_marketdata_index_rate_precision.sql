-- +goose Up
-- Coverage rows T-05 and F-03: a rate keeps the decimals of its source, up to 20, so the IPCA read
-- from the index numbers of the IBGE compounds to their ratio. The rates of the IPCA and of the
-- IGP-M read from series rounded to 2 decimals are deleted; the next tick reads them again from
-- the exact sources.
ALTER TABLE marketdata_index_rate ALTER COLUMN rate TYPE numeric;
ALTER TABLE marketdata_index_rate ADD CONSTRAINT marketdata_index_rate_scale CHECK (scale(rate) <= 20);
DELETE FROM marketdata_index_rate WHERE source IN ('br_ipca', 'br_igpm');

-- +goose Down
ALTER TABLE marketdata_index_rate DROP CONSTRAINT marketdata_index_rate_scale;
ALTER TABLE marketdata_index_rate ALTER COLUMN rate TYPE numeric(20, 12);

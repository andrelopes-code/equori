-- +goose Up
ALTER TABLE marketdata_instrument
    ADD COLUMN quote_currency text REFERENCES marketdata_instrument (code),
    ADD COLUMN exchange       text CHECK (exchange IN ('B3')),
    ADD CHECK ((instrument_type = 'currency') = (quote_currency IS NULL));

-- Prices are instance-wide facts; the chosen price of a date is the lowest priority,
-- then the latest recorded_at (P8 amendment A60).
CREATE TABLE marketdata_price (
    instrument       text           NOT NULL REFERENCES marketdata_instrument (code),
    quote_instrument text           NOT NULL REFERENCES marketdata_instrument (code),
    date             date           NOT NULL,
    value            numeric(30, 12) NOT NULL CHECK (value > 0),
    source           text           NOT NULL CHECK (source IN ('manual', 'csv', 'bcb_ptax', 'b3_cotahist')),
    priority         smallint       NOT NULL,
    recorded_at      timestamptz    NOT NULL DEFAULT now(),
    PRIMARY KEY (instrument, quote_instrument, date, source),
    CHECK (instrument <> quote_instrument),
    CHECK (priority = CASE source WHEN 'manual' THEN 1 WHEN 'csv' THEN 2 ELSE 3 END)
);

CREATE INDEX marketdata_price_latest ON marketdata_price (instrument, quote_instrument, date DESC);

-- +goose Down
DROP TABLE marketdata_price;
ALTER TABLE marketdata_instrument DROP COLUMN exchange, DROP COLUMN quote_currency;

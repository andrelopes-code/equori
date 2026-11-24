-- +goose Up
-- A session of the exchange of an instrument that every enabled source answered without a price
-- (A265 PH5); it is not asked again.
CREATE TABLE marketdata_price_hole (
    instrument text NOT NULL REFERENCES marketdata_instrument (code) ON DELETE CASCADE,
    quote_instrument text NOT NULL REFERENCES marketdata_instrument (code) ON DELETE CASCADE,
    date date NOT NULL,
    PRIMARY KEY (instrument, quote_instrument, date)
);

-- +goose Down
DROP TABLE marketdata_price_hole;

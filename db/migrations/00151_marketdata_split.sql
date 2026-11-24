-- +goose Up
-- A split of an instrument that the stored closes confirm (A266 SA1, SA3): the first session in new
-- units and the units after it for each unit before it.
CREATE TABLE marketdata_split (
    instrument text NOT NULL REFERENCES marketdata_instrument (code) ON DELETE CASCADE,
    date date NOT NULL,
    ratio numeric(24, 12) NOT NULL CHECK (ratio > 0),
    source text NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    PRIMARY KEY (instrument, date)
);

-- +goose Down
DROP TABLE marketdata_split;

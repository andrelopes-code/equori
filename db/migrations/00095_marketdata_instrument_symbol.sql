-- +goose Up
-- A222 MQ20: the symbol a source requests for an instrument, set by a member. It belongs to the
-- instance, as marketdata_instrument does (ADR 025, Context).
CREATE TABLE marketdata_instrument_symbol (
    instrument text NOT NULL REFERENCES marketdata_instrument (code) ON DELETE CASCADE,
    source     text NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    symbol     text NOT NULL CHECK (symbol ~ '^[A-Za-z0-9.=^_-]{1,40}$'),
    PRIMARY KEY (instrument, source)
);

-- +goose Down
DROP TABLE marketdata_instrument_symbol;

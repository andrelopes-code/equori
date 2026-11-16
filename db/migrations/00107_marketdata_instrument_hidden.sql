-- +goose Up
-- Instrument hiding A238 HD1: the instruments a book keeps out of its lists.
CREATE TABLE marketdata_instrument_hidden (
    books_id bigint NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    instrument text NOT NULL REFERENCES marketdata_instrument (code) ON DELETE CASCADE,
    hidden_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (books_id, instrument)
);

-- +goose Down
DROP TABLE marketdata_instrument_hidden;

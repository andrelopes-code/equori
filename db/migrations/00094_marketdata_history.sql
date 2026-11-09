-- +goose Up
-- A222 MQ4: one row is one request for the prices of an instrument from a source since a date.
-- The queue belongs to the instance, as marketdata_feed does (ADR 025, Context).
CREATE TABLE marketdata_history (
    source       text        NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    instrument   text        NOT NULL REFERENCES marketdata_instrument (code),
    from_date    date        NOT NULL,
    requested_at timestamptz NOT NULL,
    done_at      timestamptz,
    error        text,
    PRIMARY KEY (source, instrument)
);

-- +goose Down
DROP TABLE marketdata_history;

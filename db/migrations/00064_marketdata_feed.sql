-- +goose Up
-- ADR 025 F1: the stored state of a price or index feed, for the whole instance.
CREATE TABLE marketdata_feed (
    id      text    PRIMARY KEY CHECK (id ~ '^[a-z0-9_]{2,40}$'),
    enabled boolean NOT NULL
);

-- +goose Down
DROP TABLE marketdata_feed;

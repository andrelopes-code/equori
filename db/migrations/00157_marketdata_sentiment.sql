-- +goose Up
-- Contribution conditions CO17: the daily value of a sentiment index, whole, from 0 to 100.
CREATE TABLE marketdata_sentiment (
    index_id text     NOT NULL CHECK (index_id ~ '^[a-z0-9_]{2,40}$'),
    date     date     NOT NULL,
    value    smallint NOT NULL CHECK (value BETWEEN 0 AND 100),
    source   text     NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    PRIMARY KEY (index_id, date)
);

-- +goose Down
DROP TABLE marketdata_sentiment;

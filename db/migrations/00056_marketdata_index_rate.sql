-- +goose Up
-- Investments design 4.2: the rate of an index for each period it publishes (a business day for
-- the cdi, a month for the ipca), as an exact decimal fraction, e.g. 0.00055131 for 0.055131%.
CREATE TABLE marketdata_index_rate (
    index_id text    NOT NULL CHECK (index_id ~ '^[a-z0-9_]{2,40}$'),
    date     date    NOT NULL,
    rate     numeric(20, 12) NOT NULL CHECK (rate > -1),
    source   text    NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    PRIMARY KEY (index_id, date)
);

-- +goose Down
DROP TABLE marketdata_index_rate;

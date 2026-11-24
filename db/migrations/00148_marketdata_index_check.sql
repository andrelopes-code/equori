-- +goose Up
-- The last whole read of an index (A265 RI1, RI4): the first day it asked for, the day it ran and
-- the expected days still without a rate after it.
CREATE TABLE marketdata_index_check (
    index_id text PRIMARY KEY CHECK (index_id ~ '^[a-z0-9_]{2,40}$'),
    from_date date NOT NULL,
    checked_on date NOT NULL,
    missing integer NOT NULL CHECK (missing >= 0)
);

-- +goose Down
DROP TABLE marketdata_index_check;

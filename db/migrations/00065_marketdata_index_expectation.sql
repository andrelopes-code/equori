-- +goose Up
-- ADR 026 E3: the expected annual rate of an index on each date of the latest survey of a source.
CREATE TABLE marketdata_index_expectation (
    index_id    text            NOT NULL CHECK (index_id ~ '^[a-z0-9_]{2,40}$'),
    date        date            NOT NULL,
    rate        numeric(20, 12) NOT NULL CHECK (rate > -1),
    survey_date date            NOT NULL,
    source      text            NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    PRIMARY KEY (index_id, date)
);

-- +goose Down
DROP TABLE marketdata_index_expectation;

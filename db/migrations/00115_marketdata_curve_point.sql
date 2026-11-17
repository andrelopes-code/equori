-- +goose Up
-- Indexer comparison IC12: the annual rate a market pays by maturity on the base date of a curve.
CREATE TABLE marketdata_curve_point (
    curve_id  text            NOT NULL CHECK (curve_id ~ '^[a-z0-9_]{2,40}$'),
    maturity  date            NOT NULL,
    rate      numeric(20, 12) NOT NULL CHECK (rate > -1),
    base_date date            NOT NULL,
    source    text            NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    PRIMARY KEY (curve_id, maturity)
);

-- +goose Down
DROP TABLE marketdata_curve_point;

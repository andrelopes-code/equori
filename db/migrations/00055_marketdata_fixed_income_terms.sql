-- +goose Up
-- Investments design 4.2: the terms of a fixed income security, from which its price accrues.
CREATE TABLE marketdata_fixed_income_terms (
    instrument_code     text     PRIMARY KEY REFERENCES marketdata_instrument (code),
    issued_on           date     NOT NULL,
    matures_on          date     NOT NULL CHECK (matures_on > issued_on),
    index_id            text     CHECK (index_id IS NULL OR index_id ~ '^[a-z0-9_]{2,40}$'),
    percent_of_index_bp integer  NOT NULL DEFAULT 10000 CHECK (percent_of_index_bp > 0),
    spread_bp           integer  NOT NULL DEFAULT 0 CHECK (spread_bp >= 0),
    day_count           text     NOT NULL CHECK (day_count IN ('bus252', 'act365')),
    face_value          bigint   NOT NULL CHECK (face_value > 0),
    -- Business days are counted from the index's own publications, so only the cdi index has them.
    CHECK (day_count = 'act365' OR index_id = 'cdi')
);

-- +goose Down
DROP TABLE marketdata_fixed_income_terms;

-- +goose Up
-- Contribution rules GR10: the rules of a group by rule, keyed by position.
CREATE TABLE portfolio_contribution_rule (
    books_id          bigint  NOT NULL,
    class_id          uuid    NOT NULL,
    position          integer NOT NULL CHECK (position BETWEEN 0 AND 4),
    instrument_type   text    CHECK (instrument_type ~ '^[a-z0-9_]{2,40}$'),
    subtypes          text[]  CHECK (cardinality(subtypes) BETWEEN 1 AND 20),
    quote_currency    text,
    return_kind       text    CHECK (return_kind IN ('rate', 'inflation', 'fixed')),
    matures_from_year integer CHECK (matures_from_year BETWEEN 1900 AND 2200),
    matures_to_year   integer CHECK (matures_to_year BETWEEN 1900 AND 2200),
    daily_liquidity   boolean,
    guarantee         text    CHECK (guarantee IN ('covered', 'sovereign', 'uncovered')),
    PRIMARY KEY (class_id, position),
    FOREIGN KEY (books_id, class_id) REFERENCES portfolio_contribution_class (books_id, id) ON DELETE CASCADE,
    CHECK (matures_from_year IS NULL OR matures_to_year IS NULL OR matures_from_year <= matures_to_year),
    CHECK (num_nonnulls(instrument_type, subtypes, quote_currency, return_kind, matures_from_year,
        matures_to_year, daily_liquidity, guarantee) > 0)
);

-- +goose Down
DROP TABLE portfolio_contribution_rule;

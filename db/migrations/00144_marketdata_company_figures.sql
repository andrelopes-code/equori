-- +goose Up
-- Contribution criteria AC15: the accounts of the parent's holders, whether the classes of share
-- earn alike, the shares of a listed unit, and the capital in units of shares a second filing
-- states by year.
ALTER TABLE marketdata_company_report
    ADD COLUMN net_income_parent bigint,
    ADD COLUMN equity_minority   bigint,
    ADD COLUMN classes_differ    boolean NOT NULL DEFAULT false;

ALTER TABLE marketdata_company_listing
    ADD COLUMN shares_per_unit smallint CHECK (shares_per_unit BETWEEN 1 AND 100);

CREATE TABLE marketdata_company_share_count (
    source     text     NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    identifier text     NOT NULL CHECK (identifier <> ''),
    year       smallint NOT NULL,
    shares     bigint   NOT NULL CHECK (shares > 0),
    PRIMARY KEY (source, identifier, year)
);

-- +goose Down
DROP TABLE marketdata_company_share_count;

ALTER TABLE marketdata_company_listing
    DROP COLUMN shares_per_unit;

ALTER TABLE marketdata_company_report
    DROP COLUMN classes_differ,
    DROP COLUMN equity_minority,
    DROP COLUMN net_income_parent;

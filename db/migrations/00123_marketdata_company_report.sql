-- +goose Up
-- Company report CR6: the accounts a listed company files for a fiscal year or a year to date, and
-- the trading codes that name it. Public data shared by the instance, as marketdata_fund_report.
CREATE TABLE marketdata_company_report (
    source              text     NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    identifier          text     NOT NULL CHECK (identifier <> ''),
    period              date     NOT NULL,
    months              smallint NOT NULL CHECK (months BETWEEN 1 AND 12),
    file                text     NOT NULL CHECK (file ~ '^[a-z0-9_]{2,40}$'),
    currency            text     NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    name                text     NOT NULL CHECK (name <> ''),
    consolidated        boolean  NOT NULL,
    plan                text     NOT NULL CHECK (plan ~ '^[a-z0-9_]{2,40}$'),
    delivered           date,
    total_assets        bigint,
    current_assets      bigint,
    cash                bigint,
    short_investments   bigint,
    current_liabilities bigint,
    short_debt          bigint,
    long_debt           bigint,
    equity              bigint,
    revenue             bigint,
    gross_profit        bigint,
    net_income          bigint,
    operating_cash_flow bigint,
    shares_issued       bigint,
    shares_treasury     bigint,
    PRIMARY KEY (source, identifier, period, months)
);

CREATE INDEX marketdata_company_report_file ON marketdata_company_report (source, file);

CREATE TABLE marketdata_company_listing (
    source     text NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    exchange   text NOT NULL CHECK (exchange ~ '^[A-Z0-9]{4}$'),
    code       text NOT NULL CHECK (code ~ '^[A-Z0-9.]{2,20}$'),
    identifier text NOT NULL CHECK (identifier <> ''),
    name       text NOT NULL,
    PRIMARY KEY (source, exchange, code)
);

-- +goose Down
DROP TABLE marketdata_company_listing;
DROP TABLE marketdata_company_report;

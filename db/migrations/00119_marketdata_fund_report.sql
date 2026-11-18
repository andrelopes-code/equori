-- +goose Up
-- Fund report FR6: the figures a listed fund reports for a month, by exchange and trading code.
-- Public data shared by the instance, as marketdata_curve_point.
CREATE TABLE marketdata_fund_report (
    source             text            NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    exchange           text            NOT NULL CHECK (exchange ~ '^[A-Z0-9]{4}$'),
    code               text            NOT NULL CHECK (code ~ '^[A-Z0-9.]{2,20}$'),
    period             date            NOT NULL CHECK (extract(day FROM period) = 1),
    currency           text            NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    identifier         text            NOT NULL CHECK (identifier <> ''),
    name               text            NOT NULL CHECK (name <> ''),
    segment            text            NOT NULL,
    delivered          date,
    net_assets         bigint,
    holders            bigint,
    units              numeric(30, 8),
    unit_book_value    numeric(30, 12),
    admin_fee          numeric(20, 12),
    month_yield        numeric(20, 12),
    month_amortization numeric(20, 12),
    PRIMARY KEY (source, exchange, code, period)
);

-- +goose Down
DROP TABLE marketdata_fund_report;

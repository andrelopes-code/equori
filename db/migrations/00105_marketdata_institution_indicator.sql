-- +goose Up
-- A237: the prudential indicators of an institution, by identifier of a scheme, from the latest
-- period a source published. Public data shared by the instance, as marketdata_price (ADR 025).
CREATE TABLE marketdata_institution_indicator (
    scheme            text            NOT NULL CHECK (scheme ~ '^[a-z0-9_]{2,40}$'),
    identifier        text            NOT NULL CHECK (identifier <> ''),
    source            text            NOT NULL CHECK (source ~ '^[a-z0-9_]{2,40}$'),
    period            date            NOT NULL,
    currency          text            NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    conglomerate_code text            NOT NULL CHECK (conglomerate_code <> ''),
    conglomerate_name text            NOT NULL CHECK (conglomerate_name <> ''),
    basel             numeric(20, 10),
    principal_capital numeric(20, 10),
    fixed_asset       numeric(20, 10),
    equity            bigint,
    net_income        bigint,
    PRIMARY KEY (scheme, identifier)
);

-- +goose Down
DROP TABLE marketdata_institution_indicator;

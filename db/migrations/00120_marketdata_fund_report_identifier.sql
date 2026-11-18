-- +goose Up
-- Fund report FR4, FR15: a report is stored under the fund's identifier; a code that two funds
-- give in one period is kept on both rows, marked shared, and reaches an instrument only by link.
-- The table holds refetched market data: emptying it makes the next tick read both years again,
-- so the shared rows of past periods are stored too.
TRUNCATE marketdata_fund_report;

ALTER TABLE marketdata_fund_report DROP CONSTRAINT marketdata_fund_report_pkey;

ALTER TABLE marketdata_fund_report ADD COLUMN shared boolean NOT NULL DEFAULT false;

ALTER TABLE marketdata_fund_report ADD PRIMARY KEY (source, identifier, period);

CREATE UNIQUE INDEX marketdata_fund_report_code ON marketdata_fund_report (
    source, exchange, code, period
) WHERE NOT shared;

-- +goose Down
TRUNCATE marketdata_fund_report;

DROP INDEX marketdata_fund_report_code;

ALTER TABLE marketdata_fund_report DROP CONSTRAINT marketdata_fund_report_pkey;

ALTER TABLE marketdata_fund_report DROP COLUMN shared;

ALTER TABLE marketdata_fund_report ADD PRIMARY KEY (source, exchange, code, period);

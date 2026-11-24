-- name: DeleteCompanyReportFile :exec
DELETE FROM marketdata_company_report
WHERE
    source = @source
    AND file = @file;

-- name: DeleteCompanyReportsOutside :exec
-- Keeps the rows of the files named in @files.
DELETE FROM marketdata_company_report
WHERE
    source = @source
    AND NOT (file = ANY (@files::TEXT[]));

-- name: InsertCompanyReport :exec
INSERT INTO
    marketdata_company_report (
        source,
        identifier,
        period,
        months,
        file,
        currency,
        name,
        consolidated,
        plan,
        delivered,
        total_assets,
        current_assets,
        cash,
        short_investments,
        current_liabilities,
        short_debt,
        long_debt,
        equity,
        revenue,
        gross_profit,
        net_income,
        operating_cash_flow,
        shares_issued,
        shares_treasury,
        net_income_parent,
        equity_minority,
        classes_differ,
        capital_raised
    )
VALUES
    (
        @source,
        @identifier,
        @period,
        @months,
        @file,
        @currency,
        @name,
        @consolidated,
        @plan,
        @delivered,
        @total_assets,
        @current_assets,
        @cash,
        @short_investments,
        @current_liabilities,
        @short_debt,
        @long_debt,
        @equity,
        @revenue,
        @gross_profit,
        @net_income,
        @operating_cash_flow,
        @shares_issued,
        @shares_treasury,
        @net_income_parent,
        @equity_minority,
        @classes_differ,
        @capital_raised
    );

-- name: DeleteCompanyListings :exec
DELETE FROM marketdata_company_listing
WHERE
    source = @source;

-- name: InsertCompanyListing :exec
INSERT INTO
    marketdata_company_listing (source, exchange, code, identifier, name, shares_per_unit, financial)
VALUES
    (@source, @exchange, @code, @identifier, @name, @shares_per_unit, @financial);

-- name: CompanyListing :one
SELECT
    identifier,
    shares_per_unit
FROM
    marketdata_company_listing
WHERE
    source = @source
    AND exchange = @exchange
    AND code = @code;

-- name: CompanyFinancial :one
-- CR4: whether a listing of the identifier is of the financial sector; false without a listing.
SELECT
    coalesce(bool_or(financial), FALSE)::boolean AS financial
FROM
    marketdata_company_listing
WHERE
    source = @source
    AND identifier = @identifier;

-- name: ListCompanyReports :many
-- CR6: the reports of the identifier, newest period first, then most months first.
SELECT
    identifier,
    period,
    months,
    currency,
    name,
    consolidated,
    plan,
    delivered,
    total_assets,
    current_assets,
    cash,
    short_investments,
    current_liabilities,
    short_debt,
    long_debt,
    equity,
    revenue,
    gross_profit,
    net_income,
    operating_cash_flow,
    shares_issued,
    shares_treasury,
    net_income_parent,
    equity_minority,
    classes_differ,
    capital_raised
FROM
    marketdata_company_report
WHERE
    source = @source
    AND identifier = @identifier
ORDER BY
    period DESC,
    months DESC;

-- name: LatestCompanyReportPeriod :one
-- found is false, and latest meaningless, when the source stored no report.
SELECT
    coalesce(max(period), DATE '0001-01-01')::date AS latest,
    (count(*) > 0)::boolean AS found
FROM
    marketdata_company_report
WHERE
    source = @source;

-- name: DeleteCompanyShareCounts :exec
-- Deletes the counts of the years read and those of a year outside the window.
DELETE FROM marketdata_company_share_count
WHERE
    source = @source
    AND (
        YEAR = ANY (@read_years::SMALLINT[])
        OR NOT (YEAR = ANY (@window_years::SMALLINT[]))
    );

-- name: InsertCompanyShareCount :exec
INSERT INTO
    marketdata_company_share_count (source, identifier, YEAR, shares)
VALUES
    (@source, @identifier, @year, @shares);

-- name: ListCompanyShareCounts :many
SELECT
    YEAR,
    shares
FROM
    marketdata_company_share_count
WHERE
    source = @source
    AND identifier = @identifier
ORDER BY
    YEAR;

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
        shares_treasury
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
        @shares_treasury
    );

-- name: DeleteCompanyListings :exec
DELETE FROM marketdata_company_listing
WHERE
    source = @source;

-- name: InsertCompanyListing :exec
INSERT INTO
    marketdata_company_listing (source, exchange, code, identifier, name)
VALUES
    (@source, @exchange, @code, @identifier, @name);

-- name: CompanyListingIdentifier :one
SELECT
    identifier
FROM
    marketdata_company_listing
WHERE
    source = @source
    AND exchange = @exchange
    AND code = @code;

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
    shares_treasury
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

-- name: DeleteFundReportPeriod :exec
DELETE FROM marketdata_fund_report
WHERE
    source = @source
    AND period = @period;

-- name: DeleteFundReportPeriodsBeyond :exec
-- Keeps the @kept latest periods of the source.
DELETE FROM marketdata_fund_report AS stored
WHERE
    stored.source = @source
    AND stored.period NOT IN (
        SELECT DISTINCT
            latest.period
        FROM
            marketdata_fund_report AS latest
        WHERE
            latest.source = @source
        ORDER BY
            latest.period DESC
        LIMIT
            @kept::int
    );

-- name: ListFundReportPeriods :many
SELECT DISTINCT
    period
FROM
    marketdata_fund_report
WHERE
    source = @source
ORDER BY
    period DESC;

-- name: InsertFundReport :exec
INSERT INTO
    marketdata_fund_report (
        source,
        exchange,
        code,
        period,
        currency,
        identifier,
        name,
        segment,
        delivered,
        net_assets,
        holders,
        units,
        unit_book_value,
        admin_fee,
        month_yield,
        month_amortization
    )
VALUES
    (
        @source,
        @exchange,
        @code,
        @period,
        @currency,
        @identifier,
        @name,
        @segment,
        @delivered,
        @net_assets,
        @holders,
        @units,
        @unit_book_value,
        @admin_fee,
        @month_yield,
        @month_amortization
    );

-- name: ListFundReports :many
-- Newest period first within a source.
SELECT
    source,
    period,
    currency,
    identifier,
    name,
    segment,
    delivered,
    net_assets,
    holders,
    units,
    unit_book_value,
    admin_fee,
    month_yield,
    month_amortization
FROM
    marketdata_fund_report
WHERE
    exchange = @exchange
    AND code = @code
ORDER BY
    source,
    period DESC;

-- name: LatestFundReportPeriod :one
-- found is false, and latest meaningless, when the source stored no report.
SELECT
    coalesce(max(period), DATE '0001-01-01')::date AS latest,
    (count(*) > 0)::boolean AS found
FROM
    marketdata_fund_report
WHERE
    source = @source;

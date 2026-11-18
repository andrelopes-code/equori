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
        month_amortization,
        shared
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
        @month_amortization,
        @shared
    );

-- name: ListFundReports :many
-- FR15: the rows of the identifier when it is given, else the rows of the exchange and code that
-- are not shared; newest period first.
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
    source = @source
    AND (
        (
            sqlc.narg (identifier)::text IS NULL
            AND exchange = @exchange
            AND code = @code
            AND NOT shared
        )
        OR identifier = sqlc.narg (identifier)::text
    )
ORDER BY
    period DESC;

-- name: ListFundReportCandidates :many
-- FR15: the funds whose shared rows carry the exchange and code, with their latest name and
-- segment.
SELECT DISTINCT
    ON (identifier) identifier,
    name,
    segment
FROM
    marketdata_fund_report
WHERE
    source = @source
    AND exchange = @exchange
    AND code = @code
    AND shared
ORDER BY
    identifier,
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

-- name: DeleteInstitutionPeriod :exec
DELETE FROM marketdata_institution_indicator
WHERE
    source = @source
    AND period = @period;

-- name: DeleteInstitutionPeriodsBeyond :exec
-- Keeps the @kept latest periods of the source.
DELETE FROM marketdata_institution_indicator AS stored
WHERE
    stored.source = @source
    AND stored.period NOT IN (
        SELECT DISTINCT
            latest.period
        FROM
            marketdata_institution_indicator AS latest
        WHERE
            latest.source = @source
        ORDER BY
            latest.period DESC
        LIMIT
            @kept::int
    );

-- name: ListInstitutionPeriods :many
SELECT DISTINCT
    period
FROM
    marketdata_institution_indicator
WHERE
    source = @source
ORDER BY
    period DESC;

-- name: InsertInstitutionIndicator :exec
INSERT INTO
    marketdata_institution_indicator (
        scheme,
        identifier,
        source,
        period,
        currency,
        conglomerate_code,
        conglomerate_name,
        basel,
        principal_capital,
        fixed_asset,
        equity,
        net_income
    )
VALUES
    (
        @scheme,
        @identifier,
        @source,
        @period,
        @currency,
        @conglomerate_code,
        @conglomerate_name,
        @basel,
        @principal_capital,
        @fixed_asset,
        @equity,
        @net_income
    );

-- name: ListInstitutionIndicators :many
-- Newest period first.
SELECT
    source,
    period,
    currency,
    conglomerate_code,
    conglomerate_name,
    basel,
    principal_capital,
    fixed_asset,
    equity,
    net_income
FROM
    marketdata_institution_indicator
WHERE
    scheme = @scheme
    AND identifier = @identifier
ORDER BY
    period DESC;

-- name: LatestInstitutionPeriod :one
-- found is false, and latest meaningless, when the source stored no indicator.
SELECT
    coalesce(max(period), DATE '0001-01-01')::date AS latest,
    (count(*) > 0)::boolean AS found
FROM
    marketdata_institution_indicator
WHERE
    source = @source;

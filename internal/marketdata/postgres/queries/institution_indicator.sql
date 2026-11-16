-- name: DeleteInstitutionIndicators :exec
DELETE FROM marketdata_institution_indicator
WHERE
    source = @source;

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

-- name: GetInstitutionIndicator :one
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
    AND identifier = @identifier;

-- name: LatestInstitutionPeriod :one
-- found is false, and latest meaningless, when the source stored no indicator.
SELECT
    coalesce(max(period), DATE '0001-01-01')::date AS latest,
    (count(*) > 0)::boolean AS found
FROM
    marketdata_institution_indicator
WHERE
    source = @source;

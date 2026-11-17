-- name: DeleteCurvePoints :exec
DELETE FROM marketdata_curve_point
WHERE
    curve_id = @curve_id;

-- name: InsertCurvePoint :exec
INSERT INTO
    marketdata_curve_point (curve_id, maturity, rate, base_date, source)
VALUES
    (@curve_id, @maturity, @rate, @base_date, @source);

-- name: ListCurvePoints :many
SELECT
    maturity,
    rate,
    base_date
FROM
    marketdata_curve_point
WHERE
    curve_id = @curve_id
ORDER BY
    maturity;

-- name: LatestCurveBase :one
-- found is false, and latest meaningless, when the source stored no point.
SELECT
    coalesce(max(base_date), DATE '0001-01-01')::date AS latest,
    (count(*) > 0)::boolean AS found
FROM
    marketdata_curve_point
WHERE
    source = @source;

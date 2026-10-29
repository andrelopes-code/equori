-- name: ListInstanceHolidays :many
SELECT
    *
FROM
    marketdata_holiday
WHERE
    calendar = @calendar
    AND date >= @from_date
    AND date <= @to_date
ORDER BY
    date;

-- name: IsInstanceHoliday :one
SELECT
    EXISTS (
        SELECT
            1
        FROM
            marketdata_holiday
        WHERE
            calendar = $1
            AND date = $2
    );

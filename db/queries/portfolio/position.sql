-- name: DeletePositionDays :exec
DELETE FROM portfolio_position_day
WHERE
    user_id = @user_id
    AND account_id = ANY (@account_ids::UUID[]);

-- name: InsertPositionDay :exec
INSERT INTO
    portfolio_position_day (user_id, account_id, instrument, date, quantity, cost_basis)
VALUES
    (@user_id, @account_id, @instrument, @date, @quantity, @cost_basis);

-- name: PositionsAt :many
-- The latest row of each security account on or before on_date, without empty positions.
SELECT
    *
FROM
    (
        SELECT DISTINCT
            ON (account_id) *
        FROM
            portfolio_position_day
        WHERE
            user_id = @user_id
            AND date <= @on_date
        ORDER BY
            account_id,
            date DESC
    ) latest
WHERE
    quantity <> 0
ORDER BY
    instrument,
    account_id;

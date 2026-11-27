-- name: OpeningLosses :many
SELECT
    pool,
    MONTH,
    amount
FROM
    portfolio_opening_loss
WHERE
    books_id = @books_id
ORDER BY
    pool;

-- name: DeleteOpeningLosses :exec
DELETE FROM portfolio_opening_loss
WHERE
    books_id = @books_id;

-- name: InsertOpeningLoss :exec
INSERT INTO
    portfolio_opening_loss (books_id, pool, MONTH, amount)
VALUES
    (@books_id, @pool, @month, @amount);

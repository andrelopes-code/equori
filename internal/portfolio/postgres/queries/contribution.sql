-- name: GetContributionPlan :one
SELECT
    amount,
    currency
FROM
    portfolio_contribution_plan
WHERE
    books_id = @books_id;

-- name: ListContributionClasses :many
SELECT
    id,
    position,
    name,
    target_bp
FROM
    portfolio_contribution_class
WHERE
    books_id = @books_id
ORDER BY
    position;

-- name: ListContributionMembers :many
SELECT
    m.class_id,
    m.position,
    m.account_id,
    m.instrument,
    m.target_bp
FROM
    portfolio_contribution_member AS m
    JOIN portfolio_contribution_class AS c ON c.books_id = m.books_id
    AND c.id = m.class_id
WHERE
    m.books_id = @books_id
ORDER BY
    c.position,
    m.position;

-- name: DeleteContributionPlan :exec
DELETE FROM portfolio_contribution_plan
WHERE
    books_id = @books_id;

-- name: InsertContributionPlan :exec
INSERT INTO
    portfolio_contribution_plan (books_id, amount, currency)
VALUES
    (@books_id, sqlc.narg (amount), sqlc.narg (currency));

-- name: InsertContributionClass :one
INSERT INTO
    portfolio_contribution_class (books_id, position, name, target_bp)
VALUES
    (@books_id, @position, @name, @target_bp)
RETURNING
    id;

-- name: InsertContributionMember :exec
INSERT INTO
    portfolio_contribution_member (books_id, class_id, position, account_id, instrument, target_bp)
VALUES
    (
        @books_id,
        @class_id,
        @position,
        sqlc.narg (account_id),
        sqlc.narg (instrument),
        sqlc.narg (target_bp)
    );

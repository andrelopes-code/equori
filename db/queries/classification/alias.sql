-- name: ListAliases :many
SELECT
    *
FROM
    classification_payee_alias
WHERE
    user_id = @user_id
    AND (
        sqlc.narg (after_id)::uuid IS NULL
        OR id > sqlc.narg (after_id)::uuid
    )
ORDER BY
    id
LIMIT
    @row_limit;

-- name: AllAliases :many
SELECT
    *
FROM
    classification_payee_alias
WHERE
    user_id = $1
ORDER BY
    id;

-- name: GetAlias :one
SELECT
    *
FROM
    classification_payee_alias
WHERE
    user_id = $1
    AND id = $2;

-- name: InsertAlias :one
INSERT INTO
    classification_payee_alias (user_id, pattern, match_type, payee_id)
VALUES
    (@user_id, @pattern, @match_type, @payee_id)
RETURNING
    *;

-- name: UpdateAlias :one
UPDATE classification_payee_alias
SET
    pattern = @pattern,
    match_type = @match_type,
    payee_id = @payee_id
WHERE
    user_id = @user_id
    AND id = @id
RETURNING
    *;

-- name: DeleteAlias :execrows
DELETE FROM classification_payee_alias
WHERE
    user_id = $1
    AND id = $2;

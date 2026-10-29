-- name: InsertProvider :exec
INSERT INTO
    assistant_provider (id, user_id, preset, name, base_url, sealed_key, created_at)
VALUES
    (@id, @user_id, @preset, @name, @base_url, @sealed_key, @created_at);

-- name: GetProvider :one
SELECT
    *
FROM
    assistant_provider
WHERE
    user_id = $1
    AND id = $2;

-- name: ListProviders :many
SELECT
    *
FROM
    assistant_provider
WHERE
    user_id = $1
ORDER BY
    created_at,
    id;

-- name: UpdateProvider :execrows
UPDATE assistant_provider
SET
    name = @name,
    base_url = @base_url,
    sealed_key = @sealed_key
WHERE
    user_id = @user_id
    AND id = @id;

-- name: DeleteProvider :execrows
DELETE FROM assistant_provider
WHERE
    user_id = $1
    AND id = $2;

-- name: LockAllKeys :many
-- Rotation (ADR 008 K4) reseals every user's keys: the one query without a user filter.
SELECT
    id,
    user_id,
    sealed_key
FROM
    assistant_provider
WHERE
    sealed_key IS NOT NULL
ORDER BY
    id
FOR UPDATE;

-- name: ResealKey :exec
UPDATE assistant_provider
SET
    sealed_key = @sealed_key
WHERE
    user_id = @user_id
    AND id = @id;

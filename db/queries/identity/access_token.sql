-- name: CreateAccessToken :exec
INSERT INTO
    identity_access_token (id, user_id, name, scope, token_hash, created_at, expires_at)
VALUES
    ($1, $2, $3, $4, $5, $6, $7);

-- name: ListAccessTokens :many
SELECT
    id,
    user_id,
    name,
    scope,
    created_at,
    expires_at,
    last_used_at
FROM
    identity_access_token
WHERE
    user_id = $1
ORDER BY
    created_at DESC,
    id;

-- name: DeleteAccessToken :execrows
DELETE FROM identity_access_token
WHERE
    user_id = $1
    AND id = $2;

-- name: GetAccessTokenByHash :one
-- Verification knows only the token; the hash identifies the user (design 2026-10-26 X12).
SELECT
    id,
    user_id,
    name,
    scope,
    created_at,
    expires_at,
    last_used_at
FROM
    identity_access_token
WHERE
    token_hash = $1
    AND expires_at > $2;

-- name: TouchAccessToken :exec
-- X8: last_used_at moves at most once a minute.
UPDATE identity_access_token
SET
    last_used_at = $3
WHERE
    user_id = $1
    AND id = $2
    AND (
        last_used_at IS NULL
        OR last_used_at <= $3::timestamptz - interval '1 minute'
    );

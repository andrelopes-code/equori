-- name: CreateAccessToken :exec
INSERT INTO
    identity_access_token (id, member_id, books_id, name, scope, token_hash, created_at, expires_at)
VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: ListAccessTokens :many
SELECT
    id,
    member_id,
    books_id,
    name,
    scope,
    created_at,
    expires_at,
    last_used_at
FROM
    identity_access_token
WHERE
    member_id = $1
    AND books_id = $2
ORDER BY
    created_at DESC,
    id;

-- name: DeleteAccessToken :execrows
DELETE FROM identity_access_token
WHERE
    member_id = $1
    AND id = $2;

-- name: GetAccessTokenByHash :one
-- Verification knows only the token; the hash identifies the member and the book. HA16: the role is read at each use.
SELECT
    t.id,
    t.member_id,
    t.books_id,
    t.name,
    t.scope,
    t.created_at,
    t.expires_at,
    t.last_used_at,
    ms.role AS book_role
FROM
    identity_access_token t
    JOIN identity_membership ms ON ms.member_id = t.member_id
    AND ms.books_id = t.books_id
WHERE
    t.token_hash = $1
    AND t.expires_at > $2;

-- name: TouchAccessToken :exec
-- X8: last_used_at moves at most once a minute.
UPDATE identity_access_token
SET
    last_used_at = $3
WHERE
    member_id = $1
    AND id = $2
    AND (
        last_used_at IS NULL
        OR last_used_at <= $3::timestamptz - interval '1 minute'
    );

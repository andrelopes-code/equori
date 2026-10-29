-- name: CreateUser :one
INSERT INTO
    identity_user (email, password_hash, role, language, region)
VALUES
    ($1, $2, $3, $4, $5)
RETURNING
    *;

-- name: UpdateProfile :one
UPDATE identity_user
SET
    language = $2,
    region = $3
WHERE
    id = $1
RETURNING
    *;

-- name: GetUserByID :one
SELECT
    *
FROM
    identity_user
WHERE
    id = $1;

-- name: GetUserByEmail :one
SELECT
    *
FROM
    identity_user
WHERE
    email = $1;

-- name: CreateSession :exec
INSERT INTO
    identity_session (token_hash, user_id, created_at, expires_at)
VALUES
    ($1, $2, $3, $4);

-- name: GetUserBySession :one
SELECT
    u.*
FROM
    identity_session s
    JOIN identity_user u ON u.id = s.user_id
WHERE
    s.token_hash = $1
    AND s.expires_at > $2;

-- name: DeleteSession :exec
DELETE FROM identity_session
WHERE
    token_hash = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM identity_session
WHERE
    expires_at <= $1;

-- name: LockUsers :exec
-- The first-user setup creates its admin under this lock, so two requests yield one admin (W-U4).
LOCK TABLE identity_user IN EXCLUSIVE MODE;

-- name: AnyUser :one
SELECT
    EXISTS (
        SELECT
            1
        FROM
            identity_user
    );

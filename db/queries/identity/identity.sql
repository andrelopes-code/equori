-- name: CreateUser :one
INSERT INTO identity_user (email, password_hash, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM identity_user WHERE email = $1;

-- name: CreateSession :exec
INSERT INTO identity_session (token_hash, user_id, created_at, expires_at)
VALUES ($1, $2, $3, $4);

-- name: GetUserBySession :one
SELECT u.*
FROM identity_session s
JOIN identity_user u ON u.id = s.user_id
WHERE s.token_hash = $1 AND s.expires_at > $2;

-- name: DeleteSession :exec
DELETE FROM identity_session WHERE token_hash = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM identity_session WHERE expires_at <= $1;

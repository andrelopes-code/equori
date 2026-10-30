-- name: CreateMember :one
INSERT INTO
    identity_member (email, password_hash, role, language)
VALUES
    ($1, $2, $3, $4)
RETURNING
    *;

-- name: CreateBooks :one
INSERT INTO
    identity_books (region)
VALUES
    ($1)
RETURNING
    id;

-- name: CreateMembership :exec
INSERT INTO
    identity_membership (member_id, books_id, role)
VALUES
    ($1, $2, $3);

-- name: UpdateLanguage :exec
UPDATE identity_member
SET
    language = $2
WHERE
    id = $1;

-- name: UpdateRegion :exec
UPDATE identity_books
SET
    region = $2
WHERE
    id = $1;

-- name: GetLocale :one
-- BK27: the context's member when it belongs to the book, else the book's first owner.
SELECT
    b.region,
    m.language
FROM
    identity_books b
    JOIN identity_membership ms ON ms.books_id = b.id
    JOIN identity_member m ON m.id = ms.member_id
WHERE
    b.id = sqlc.arg (books_id)
ORDER BY
    (m.id = sqlc.arg (member_id)::bigint) DESC,
    (ms.role <> 'owner'),
    m.id
LIMIT
    1;

-- name: GetLoginBooks :one
SELECT
    books_id
FROM
    identity_membership
WHERE
    member_id = $1
ORDER BY
    (role <> 'owner'),
    books_id
LIMIT
    1;

-- name: GetMemberByID :one
SELECT
    *
FROM
    identity_member
WHERE
    id = $1;

-- name: GetMemberByEmail :one
SELECT
    *
FROM
    identity_member
WHERE
    email = $1;

-- name: CreateSession :exec
INSERT INTO
    identity_session (token_hash, member_id, books_id, created_at, expires_at)
VALUES
    ($1, $2, $3, $4, $5);

-- name: GetMemberBySession :one
SELECT
    m.id,
    m.email,
    m.password_hash,
    m.role,
    m.disabled_at,
    m.created_at,
    m.language,
    s.books_id
FROM
    identity_session s
    JOIN identity_member m ON m.id = s.member_id
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

-- name: LockMembers :exec
-- The first-user setup creates its admin under this lock, so two requests yield one admin (W-U4).
LOCK TABLE identity_member IN EXCLUSIVE MODE;

-- name: AnyMember :one
SELECT
    EXISTS (
        SELECT
            1
        FROM
            identity_member
    );

-- name: GetBooksZone :one
SELECT
    region,
    time_zone
FROM
    identity_books
WHERE
    id = $1;

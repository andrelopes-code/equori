-- name: CreateMember :one
INSERT INTO
    identity_member (email, password_hash, role, language)
VALUES
    ($1, $2, $3, $4)
RETURNING
    *;

-- name: CreateBooks :one
INSERT INTO
    identity_books (region, name)
VALUES
    ($1, $2)
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

-- name: UpdateDisplayName :exec
UPDATE identity_member
SET
    display_name = $2
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
-- HA3: the membership of the last visit; ties go to the lowest books ID.
SELECT
    books_id
FROM
    identity_membership
WHERE
    member_id = $1
ORDER BY
    last_active_at DESC,
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
    m.display_name,
    s.books_id,
    ms.role AS book_role
FROM
    identity_session s
    JOIN identity_member m ON m.id = s.member_id
    JOIN identity_membership ms ON ms.member_id = s.member_id
    AND ms.books_id = s.books_id
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

-- name: UpdateBooksSettings :one
UPDATE identity_books
SET
    region = $2,
    time_zone = $3,
    name = coalesce(sqlc.narg (name), name)
WHERE
    id = $1
RETURNING
    name;

-- name: GetBooksName :one
SELECT
    name
FROM
    identity_books
WHERE
    id = $1;

-- name: TouchMembership :execrows
UPDATE identity_membership
SET
    last_active_at = $3
WHERE
    member_id = $1
    AND books_id = $2;

-- name: SwitchSession :execrows
UPDATE identity_session
SET
    books_id = $3
WHERE
    token_hash = $1
    AND member_id = $2;

-- name: ListMemberBooks :many
SELECT
    b.id,
    b.name,
    ms.role
FROM
    identity_membership ms
    JOIN identity_books b ON b.id = ms.books_id
WHERE
    ms.member_id = $1
ORDER BY
    b.id;

-- name: GetAppearance :one
SELECT
    appearance
FROM
    identity_member
WHERE
    id = $1;

-- name: SetAppearance :exec
UPDATE identity_member
SET
    appearance = $2
WHERE
    id = $1;

-- name: ListMembers :many
SELECT
    ms.member_id,
    m.email,
    m.display_name,
    ms.role,
    ms.created_at
FROM
    identity_membership ms
    JOIN identity_member m ON m.id = ms.member_id
WHERE
    ms.books_id = $1
ORDER BY
    ms.created_at,
    ms.member_id;

-- name: LockBooks :exec
-- HA21: membership changes of one book run one at a time.
SELECT
    id
FROM
    identity_books
WHERE
    id = $1
FOR UPDATE;

-- name: GetMembershipRole :one
SELECT
    role
FROM
    identity_membership
WHERE
    books_id = $1
    AND member_id = $2;

-- name: CountOtherOwners :one
SELECT
    count(*)
FROM
    identity_membership
WHERE
    books_id = $1
    AND role = 'owner'
    AND member_id <> $2;

-- name: UpdateMembershipRole :exec
UPDATE identity_membership
SET ROLE = $3
WHERE
    books_id = $1
    AND member_id = $2;

-- name: DeleteMembership :exec
DELETE FROM identity_membership
WHERE
    books_id = $1
    AND member_id = $2;

-- name: CountBooksMembers :one
-- DB3: the members of one book.
SELECT
    count(*)
FROM
    identity_membership
WHERE
    books_id = $1;

-- name: CountMemberBooks :one
-- DB4: the books one member belongs to.
SELECT
    count(*)
FROM
    identity_membership
WHERE
    member_id = $1;

-- name: DeleteBooks :exec
-- DB5: every table of the book cascades from this row.
DELETE FROM identity_books
WHERE
    id = $1;

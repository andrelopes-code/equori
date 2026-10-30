-- name: DeleteExpiredInvitations :exec
DELETE FROM identity_invitation
WHERE
    books_id = $1
    AND expires_at <= $2;

-- name: IsBooksMemberEmail :one
SELECT
    EXISTS (
        SELECT
            1
        FROM
            identity_membership ms
            JOIN identity_member m ON m.id = ms.member_id
        WHERE
            ms.books_id = $1
            AND m.email = $2
    );

-- name: UpsertInvitation :one
-- HA24: a second invitation of the same email replaces the first.
INSERT INTO
    identity_invitation (id, books_id, email, role, token_hash, invited_by, created_at, expires_at)
VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (books_id, email) DO UPDATE
SET
    id = excluded.id,
    role = excluded.role,
    token_hash = excluded.token_hash,
    invited_by = excluded.invited_by,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at
RETURNING
    *;

-- name: ListInvitations :many
SELECT
    *
FROM
    identity_invitation
WHERE
    books_id = $1
ORDER BY
    created_at DESC,
    id;

-- name: DeleteInvitation :execrows
DELETE FROM identity_invitation
WHERE
    books_id = $1
    AND id = $2;

-- name: GetInvitationPreview :one
SELECT
    i.books_id,
    i.email,
    i.role,
    b.name AS books_name,
    m.email AS inviter_email,
    EXISTS (
        SELECT
            1
        FROM
            identity_member x
        WHERE
            x.email = i.email
    ) AS member_exists
FROM
    identity_invitation i
    JOIN identity_books b ON b.id = i.books_id
    JOIN identity_member m ON m.id = i.invited_by
WHERE
    i.token_hash = $1
    AND i.expires_at > $2;

-- name: ClaimInvitation :one
-- Spec section 9: the delete makes a second acceptance find no row.
DELETE FROM identity_invitation
WHERE
    token_hash = $1
    AND expires_at > $2
RETURNING
    books_id,
    email,
    role;

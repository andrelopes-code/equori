-- name: DeleteExpiredAccountInvitations :exec
DELETE FROM identity_account_invitation
WHERE
    expires_at <= $1;

-- name: MemberEmailExists :one
SELECT
    EXISTS (
        SELECT
            1
        FROM
            identity_member
        WHERE
            email = $1
    );

-- name: UpsertAccountInvitation :one
-- A second invitation of the same email replaces the first.
INSERT INTO
    identity_account_invitation (
        id,
        email,
        region,
        base_currency,
        token_hash,
        invited_by,
        created_at,
        expires_at
    )
VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (email) DO UPDATE
SET
    id = excluded.id,
    region = excluded.region,
    base_currency = excluded.base_currency,
    token_hash = excluded.token_hash,
    invited_by = excluded.invited_by,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at
RETURNING
    *;

-- name: GetAccountInvitationPreview :one
SELECT
    i.email,
    m.email AS inviter_email
FROM
    identity_account_invitation i
    JOIN identity_member m ON m.id = i.invited_by
WHERE
    i.token_hash = $1
    AND i.expires_at > $2;

-- name: ClaimAccountInvitation :one
-- The delete makes a second acceptance find no row.
DELETE FROM identity_account_invitation
WHERE
    token_hash = $1
    AND expires_at > $2
RETURNING
    email,
    region,
    base_currency;

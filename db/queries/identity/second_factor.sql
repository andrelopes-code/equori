-- name: GetSecondFactorSummary :one
-- HA39: a confirmed TOTP and the count of recovery codes.
SELECT
    EXISTS (
        SELECT
            1
        FROM
            identity_totp t
        WHERE
            t.member_id = sqlc.arg (member_id)
            AND t.confirmed_at IS NOT NULL
    )::boolean AS totp,
    (
        SELECT
            count(*)
        FROM
            identity_recovery_code c
        WHERE
            c.member_id = sqlc.arg (member_id)
    )::integer AS recovery_codes_left;

-- name: ListPasskeys :many
SELECT
    id,
    member_id,
    credential_id,
    public_key,
    algorithm,
    sign_count,
    rp_id,
    name,
    created_at,
    last_used_at
FROM
    identity_passkey
WHERE
    member_id = $1
ORDER BY
    created_at,
    id;

-- name: HasSecondFactor :one
SELECT
    (
        EXISTS (
            SELECT
                1
            FROM
                identity_totp t
            WHERE
                t.member_id = sqlc.arg (member_id)
                AND t.confirmed_at IS NOT NULL
        )
        OR EXISTS (
            SELECT
                1
            FROM
                identity_passkey p
            WHERE
                p.member_id = sqlc.arg (member_id)
        )
    )::boolean;

-- name: LockMember :one
-- HA37: enabling or removing a factor runs under this lock, so the first factor is decided once.
SELECT
    id
FROM
    identity_member
WHERE
    id = $1
FOR UPDATE;

-- name: UpsertTOTP :execrows
-- HA35: replaces an unconfirmed row; a confirmed row stays and the count is 0.
INSERT INTO
    identity_totp (member_id, sealed_secret, created_at)
VALUES
    ($1, $2, $3)
ON CONFLICT (member_id) DO UPDATE
SET
    sealed_secret = EXCLUDED.sealed_secret,
    created_at = EXCLUDED.created_at,
    last_step = 0
WHERE
    identity_totp.confirmed_at IS NULL;

-- name: GetTOTP :one
SELECT
    member_id,
    sealed_secret,
    confirmed_at,
    last_step
FROM
    identity_totp
WHERE
    member_id = $1;

-- name: ConfirmTOTP :execrows
UPDATE identity_totp
SET
    confirmed_at = sqlc.arg (confirmed_at),
    last_step = sqlc.arg (step)
WHERE
    member_id = sqlc.arg (member_id)
    AND confirmed_at IS NULL
    AND last_step < sqlc.arg (step);

-- name: UseTOTPStep :execrows
-- HA34: a step not above last_step is a replay.
UPDATE identity_totp
SET
    last_step = sqlc.arg (step)
WHERE
    member_id = sqlc.arg (member_id)
    AND confirmed_at IS NOT NULL
    AND last_step < sqlc.arg (step);

-- name: DeleteTOTP :exec
DELETE FROM identity_totp
WHERE
    member_id = $1;

-- name: ListSealedTOTP :many
SELECT
    member_id,
    sealed_secret
FROM
    identity_totp
ORDER BY
    member_id;

-- name: UpdateSealedTOTP :exec
UPDATE identity_totp
SET
    sealed_secret = $2
WHERE
    member_id = $1;

-- name: DeleteRecoveryCodes :exec
DELETE FROM identity_recovery_code
WHERE
    member_id = $1;

-- name: InsertRecoveryCode :exec
INSERT INTO
    identity_recovery_code (member_id, code_hash, created_at)
VALUES
    ($1, $2, $3);

-- name: UseRecoveryCode :execrows
DELETE FROM identity_recovery_code
WHERE
    member_id = $1
    AND code_hash = $2;

-- name: CountRecoveryCodes :one
SELECT
    count(*)::integer
FROM
    identity_recovery_code
WHERE
    member_id = $1;

-- name: DeleteOtherSessions :exec
-- HA37: the session that enabled the first factor stays.
DELETE FROM identity_session
WHERE
    member_id = $1
    AND token_hash <> $2;

-- name: DeleteMemberSessions :exec
DELETE FROM identity_session
WHERE
    member_id = $1;

-- name: UpsertPasskeyChallenge :exec
INSERT INTO
    identity_passkey_challenge (member_id, challenge, expires_at)
VALUES
    ($1, $2, $3)
ON CONFLICT (member_id) DO UPDATE
SET
    challenge = EXCLUDED.challenge,
    expires_at = EXCLUDED.expires_at;

-- name: TakePasskeyChallenge :one
DELETE FROM identity_passkey_challenge
WHERE
    member_id = $1
RETURNING
    challenge,
    expires_at;

-- name: DeletePasskeyChallenge :exec
DELETE FROM identity_passkey_challenge
WHERE
    member_id = $1;

-- name: InsertPasskey :exec
INSERT INTO
    identity_passkey (
        id,
        member_id,
        credential_id,
        public_key,
        algorithm,
        sign_count,
        rp_id,
        name,
        created_at
    )
VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, $9);

-- name: DeletePasskey :execrows
DELETE FROM identity_passkey
WHERE
    member_id = $1
    AND id = $2;

-- name: DeletePasskeys :exec
DELETE FROM identity_passkey
WHERE
    member_id = $1;

-- name: UsePasskey :execrows
-- HA43: a counter not above a stored non-zero counter is refused.
UPDATE identity_passkey
SET
    sign_count = sqlc.arg (sign_count),
    last_used_at = sqlc.arg (used_at)
WHERE
    member_id = sqlc.arg (member_id)
    AND id = sqlc.arg (id)
    AND (
        sign_count = 0
        OR sign_count < sqlc.arg (sign_count)
    );

-- name: CreateLoginChallenge :exec
INSERT INTO
    identity_login_challenge (token_hash, member_id, challenge, expires_at)
VALUES
    ($1, $2, $3, $4);

-- name: GetLoginChallenge :one
SELECT
    token_hash,
    member_id,
    challenge,
    expires_at
FROM
    identity_login_challenge
WHERE
    token_hash = $1
    AND expires_at > $2;

-- name: FailLoginChallenge :one
UPDATE identity_login_challenge
SET
    attempts = attempts + 1
WHERE
    token_hash = $1
RETURNING
    attempts;

-- name: DeleteLoginChallenge :execrows
DELETE FROM identity_login_challenge
WHERE
    token_hash = $1;

-- name: DeleteMemberLoginChallenges :exec
DELETE FROM identity_login_challenge
WHERE
    member_id = $1;

-- name: DeleteExpiredLoginChallenges :exec
DELETE FROM identity_login_challenge
WHERE
    expires_at <= $1;

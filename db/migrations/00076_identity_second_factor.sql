-- +goose Up
-- HA34: the TOTP secret of a member, sealed (ADR 008, K3); last_step refuses a replayed code.
CREATE TABLE identity_totp (
    member_id     bigint      PRIMARY KEY REFERENCES identity_member (id) ON DELETE CASCADE,
    sealed_secret bytea       NOT NULL,
    confirmed_at  timestamptz,
    last_step     bigint      NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL
);

-- HA38: the SHA-256 of each unused recovery code.
CREATE TABLE identity_recovery_code (
    member_id  bigint      NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE,
    code_hash  bytea       NOT NULL,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (member_id, code_hash)
);

-- HA43: a WebAuthn credential used as a second factor on one RP ID.
CREATE TABLE identity_passkey (
    id            uuid        PRIMARY KEY,
    member_id     bigint      NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE,
    credential_id bytea       NOT NULL UNIQUE,
    public_key    bytea       NOT NULL,
    algorithm     integer     NOT NULL CHECK (algorithm IN (-7, -8, -257)),
    sign_count    bigint      NOT NULL,
    rp_id         text        NOT NULL,
    name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    created_at    timestamptz NOT NULL,
    last_used_at  timestamptz
);

CREATE INDEX identity_passkey_member_idx ON identity_passkey (member_id);

-- HA44: the challenge of a passkey registration in progress.
CREATE TABLE identity_passkey_challenge (
    member_id  bigint      PRIMARY KEY REFERENCES identity_member (id) ON DELETE CASCADE,
    challenge  bytea       NOT NULL,
    expires_at timestamptz NOT NULL
);

-- HA46: a pending login between the password and the second factor.
CREATE TABLE identity_login_challenge (
    token_hash bytea       PRIMARY KEY,
    member_id  bigint      NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE,
    challenge  bytea       NOT NULL,
    attempts   integer     NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL
);

CREATE INDEX identity_login_challenge_member_idx ON identity_login_challenge (member_id);

-- +goose Down
DROP TABLE identity_login_challenge;
DROP TABLE identity_passkey_challenge;
DROP TABLE identity_passkey;
DROP TABLE identity_recovery_code;
DROP TABLE identity_totp;

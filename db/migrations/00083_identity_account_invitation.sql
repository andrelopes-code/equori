-- +goose Up
-- An admin invites an email to an account of its own (a member with a book of its own); the token
-- is stored as its SHA-256. One pending invitation per email.
CREATE TABLE identity_account_invitation (
    id            uuid        PRIMARY KEY,
    email         text        NOT NULL UNIQUE,
    region        text        NOT NULL CHECK (region ~ '^[A-Z]{2}$'),
    base_currency text        NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
    token_hash    bytea       NOT NULL UNIQUE,
    invited_by    bigint      NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL,
    expires_at    timestamptz NOT NULL
);

-- +goose Down
DROP TABLE identity_account_invitation;

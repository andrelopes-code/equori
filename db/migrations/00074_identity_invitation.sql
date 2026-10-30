-- +goose Up
-- HA23: one pending invitation per email and book; the token is stored as its SHA-256.
CREATE TABLE identity_invitation (
    id         uuid        PRIMARY KEY,
    books_id   bigint      NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    email      text        NOT NULL,
    role       text        NOT NULL CHECK (role IN ('owner', 'write', 'read')),
    token_hash bytea       NOT NULL UNIQUE,
    invited_by bigint      NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    UNIQUE (books_id, email)
);

-- +goose Down
DROP TABLE identity_invitation;

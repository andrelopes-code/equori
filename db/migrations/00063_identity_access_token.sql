-- +goose Up
-- MCP and assistant design X5: a personal access token opens /mcp for one user; only its SHA-256 is kept.
CREATE TABLE identity_access_token (
    id           uuid        PRIMARY KEY,
    user_id      bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name         text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    scope        text        NOT NULL CHECK (scope IN ('read', 'write')),
    token_hash   bytea       NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    created_at   timestamptz NOT NULL,
    expires_at   timestamptz NOT NULL CHECK (expires_at > created_at),
    last_used_at timestamptz
);

CREATE INDEX identity_access_token_user_idx ON identity_access_token (user_id, created_at DESC);

-- +goose Down
DROP TABLE identity_access_token;

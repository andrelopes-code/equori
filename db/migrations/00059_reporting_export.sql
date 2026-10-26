-- +goose Up
-- One export per user: a new request replaces the previous one (export design E3, E5).
CREATE TABLE reporting_export (
    id           uuid        NOT NULL DEFAULT uuidv7() PRIMARY KEY,
    user_id      bigint      NOT NULL UNIQUE REFERENCES identity_user (id) ON DELETE CASCADE,
    status       text        NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
    requested_at timestamptz NOT NULL,
    finished_at  timestamptz,
    content      bytea,
    sha256       bytea       CHECK (octet_length(sha256) = 32),
    problem      text        CHECK (problem ~ '^[a-z0-9_]{2,40}$'),
    CHECK ((status = 'pending') = (finished_at IS NULL)),
    CHECK ((status = 'ready') = (content IS NOT NULL AND sha256 IS NOT NULL)),
    CHECK ((status = 'failed') = (problem IS NOT NULL))
);

-- +goose Down
DROP TABLE reporting_export;

-- +goose Up
CREATE TABLE identity_user (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         text        NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash text        NOT NULL,
    role          text        NOT NULL CHECK (role IN ('admin', 'member')),
    disabled_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity_session (
    token_hash bytea       PRIMARY KEY,
    user_id    bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
);

CREATE INDEX identity_session_user_id_idx ON identity_session (user_id);

-- +goose Down
DROP TABLE identity_session;
DROP TABLE identity_user;

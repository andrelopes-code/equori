-- +goose Up
CREATE TABLE assistant_conversation (
    id         uuid        NOT NULL,
    user_id    bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    title      text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (id, user_id)
);
CREATE INDEX assistant_conversation_recent ON assistant_conversation (user_id, updated_at DESC, id DESC);

CREATE TABLE assistant_message (
    id              uuid        NOT NULL,
    user_id         bigint      NOT NULL,
    conversation_id uuid        NOT NULL,
    seq             integer     NOT NULL CHECK (seq >= 1),
    role            text        NOT NULL CHECK (role IN ('user', 'assistant')),
    content         text        NOT NULL CHECK (char_length(content) <= 16000 AND (role = 'assistant' OR char_length(content) >= 1)),
    outcome         text        CHECK (outcome IN ('answered', 'step_limit', 'failed')),
    created_at      timestamptz NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (conversation_id, seq),
    CHECK ((role = 'user') = (outcome IS NULL)),
    FOREIGN KEY (conversation_id, user_id) REFERENCES assistant_conversation (id, user_id) ON DELETE CASCADE
);

CREATE TABLE assistant_proposal (
    id              uuid        NOT NULL,
    user_id         bigint      NOT NULL,
    conversation_id uuid        NOT NULL,
    message_id      uuid,
    tool            text        NOT NULL CHECK (tool ~ '^[a-z][a-z0-9_]{0,63}$'),
    arguments       jsonb       NOT NULL,
    preview         jsonb       NOT NULL,
    basis           text        NOT NULL CHECK (basis ~ '^[0-9a-f]{64}$'),
    status          text        NOT NULL CHECK (status IN ('pending', 'executing', 'executed', 'failed', 'rejected', 'stale', 'discarded')),
    result          jsonb,
    created_at      timestamptz NOT NULL,
    expires_at      timestamptz NOT NULL CHECK (expires_at > created_at),
    decided_at      timestamptz,
    PRIMARY KEY (id),
    CHECK ((status IN ('pending', 'executing')) = (decided_at IS NULL)),
    FOREIGN KEY (conversation_id, user_id) REFERENCES assistant_conversation (id, user_id) ON DELETE CASCADE
);
CREATE INDEX assistant_proposal_conversation ON assistant_proposal (user_id, conversation_id, created_at);

-- +goose Down
DROP TABLE assistant_proposal;
DROP TABLE assistant_message;
DROP TABLE assistant_conversation;

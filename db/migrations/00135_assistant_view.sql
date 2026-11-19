-- +goose Up
-- Answer views design V9: a view of an answer, built by the server from a read of its turn.
CREATE TABLE assistant_view (
    id              uuid        NOT NULL,
    books_id        bigint      NOT NULL,
    conversation_id uuid        NOT NULL,
    message_id      uuid        NOT NULL REFERENCES assistant_message (id) ON DELETE CASCADE,
    seq             integer     NOT NULL CHECK (seq BETWEEN 0 AND 2),
    form            text        NOT NULL CHECK (form ~ '^[a-z][a-z0-9_]{1,39}$'),
    payload         jsonb       NOT NULL,
    created_at      timestamptz NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (message_id, seq),
    FOREIGN KEY (conversation_id, books_id) REFERENCES assistant_conversation (id, books_id) ON DELETE CASCADE
);
CREATE INDEX assistant_view_conversation ON assistant_view (books_id, conversation_id, created_at);

-- +goose Down
DROP TABLE assistant_view;

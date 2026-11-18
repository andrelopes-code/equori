-- +goose Up
-- Assistant parity design F1, F9, Q6: a file a member attaches to a message. A file not yet sent
-- has no conversation; deleting the conversation deletes its files.
CREATE TABLE assistant_conversation_file (
    id              uuid        NOT NULL,
    books_id        bigint      NOT NULL,
    member_id       bigint      NOT NULL,
    conversation_id uuid,
    name            text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
    media_type      text        NOT NULL CHECK (char_length(media_type) BETWEEN 1 AND 100),
    kind            text        NOT NULL CHECK (kind IN ('ofx', 'csv', 'pdf', 'image', 'text')),
    size            integer     NOT NULL CHECK (size BETWEEN 1 AND 10485760),
    sha256          bytea       NOT NULL CHECK (octet_length(sha256) = 32),
    content         bytea       NOT NULL,
    created_at      timestamptz NOT NULL,
    PRIMARY KEY (id),
    CHECK (octet_length(content) = size),
    UNIQUE NULLS NOT DISTINCT (books_id, member_id, conversation_id, sha256),
    FOREIGN KEY (member_id, books_id) REFERENCES identity_membership (member_id, books_id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id, books_id) REFERENCES assistant_conversation (id, books_id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE assistant_conversation_file;

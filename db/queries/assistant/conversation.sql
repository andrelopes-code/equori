-- name: InsertConversation :exec
INSERT INTO
    assistant_conversation (id, books_id, title, created_at, updated_at)
VALUES
    (@id, @books_id, @title, @created_at, @updated_at);

-- name: ConversationByID :one
SELECT
    *
FROM
    assistant_conversation
WHERE
    books_id = @books_id
    AND id = @id;

-- name: ListConversations :many
SELECT
    *
FROM
    assistant_conversation
WHERE
    books_id = @books_id
    AND (
        sqlc.narg (after_updated_at)::timestamptz IS NULL
        OR (updated_at, id) < (sqlc.narg (after_updated_at)::timestamptz, sqlc.narg (after_id)::uuid)
    )
ORDER BY
    updated_at DESC,
    id DESC
LIMIT
    @row_limit;

-- name: DeleteConversation :execrows
DELETE FROM assistant_conversation
WHERE
    books_id = @books_id
    AND id = @id;

-- name: DeleteConversations :exec
DELETE FROM assistant_conversation
WHERE
    books_id = @books_id;

-- name: AppendMessage :one
INSERT INTO
    assistant_message (id, books_id, conversation_id, seq, role, content, outcome, created_at)
SELECT
    @id,
    @books_id,
    @conversation_id,
    coalesce(
        (
            SELECT
                max(seq)
            FROM
                assistant_message
            WHERE
                conversation_id = @conversation_id
                AND books_id = @books_id
        ),
        0
    ) + 1,
    @role,
    @content,
    sqlc.narg (outcome),
    @created_at
RETURNING
    *;

-- name: TouchConversation :exec
UPDATE assistant_conversation
SET
    updated_at = @updated_at
WHERE
    books_id = @books_id
    AND id = @id;

-- name: ListMessages :many
SELECT
    *
FROM
    assistant_message
WHERE
    books_id = @books_id
    AND conversation_id = @conversation_id
ORDER BY
    seq;

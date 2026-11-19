-- name: InsertView :exec
INSERT INTO
    assistant_view (id, books_id, conversation_id, message_id, seq, form, payload, created_at)
VALUES
    (
        @id,
        @books_id,
        @conversation_id,
        @message_id,
        @seq,
        @form,
        @payload,
        @created_at
    );

-- name: ConversationViews :many
SELECT
    *
FROM
    assistant_view
WHERE
    books_id = @books_id
    AND conversation_id = @conversation_id
ORDER BY
    created_at,
    message_id,
    seq;

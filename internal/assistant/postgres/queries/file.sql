-- name: InsertFile :one
INSERT INTO
    assistant_conversation_file (
        id,
        books_id,
        member_id,
        conversation_id,
        name,
        media_type,
        kind,
        size,
        sha256,
        content,
        summary,
        created_at
    )
VALUES
    (
        @id,
        @books_id,
        @member_id,
        sqlc.narg (conversation_id),
        @name,
        @media_type,
        @kind,
        @size,
        @sha256,
        @content,
        @summary,
        @created_at
    )
ON CONFLICT (books_id, member_id, conversation_id, sha256) DO NOTHING
RETURNING
    id;

-- name: FileBySHA :one
SELECT
    id,
    conversation_id,
    name,
    media_type,
    kind,
    size,
    summary,
    created_at
FROM
    assistant_conversation_file
WHERE
    books_id = @books_id
    AND member_id = @member_id
    AND conversation_id IS NOT DISTINCT FROM sqlc.narg (conversation_id)::uuid
    AND sha256 = @sha256;

-- name: FileBytes :one
SELECT
    coalesce(sum(size), 0)::bigint
FROM
    assistant_conversation_file
WHERE
    books_id = @books_id
    AND member_id = @member_id
    AND conversation_id IS NOT DISTINCT FROM sqlc.narg (conversation_id)::uuid;

-- name: DeleteStaleUnsentFiles :exec
DELETE FROM assistant_conversation_file
WHERE
    books_id = @books_id
    AND member_id = @member_id
    AND message_id IS NULL
    AND created_at < @before;

-- name: DeleteUnsentFile :execrows
DELETE FROM assistant_conversation_file
WHERE
    books_id = @books_id
    AND member_id = @member_id
    AND message_id IS NULL
    AND id = @id;

-- name: BindFiles :many
UPDATE assistant_conversation_file
SET
    conversation_id = @conversation_id,
    message_id = @message_id
WHERE
    books_id = @books_id
    AND member_id = @member_id
    AND message_id IS NULL
    AND (
        conversation_id IS NULL
        OR conversation_id = @conversation_id
    )
    AND id = ANY (@ids::UUID[])
RETURNING
    id;

-- name: FilesOfConversation :many
SELECT
    id,
    message_id,
    name,
    kind,
    size,
    summary,
    created_at
FROM
    assistant_conversation_file
WHERE
    books_id = @books_id
    AND conversation_id = @conversation_id
    AND message_id IS NOT NULL
ORDER BY
    created_at,
    id;

-- name: UnsentFiles :many
SELECT
    id,
    conversation_id,
    name,
    kind,
    size,
    summary
FROM
    assistant_conversation_file
WHERE
    books_id = @books_id
    AND member_id = @member_id
    AND message_id IS NULL
    AND id = ANY (@ids::UUID[])
ORDER BY
    created_at,
    id;

-- name: FileContent :one
SELECT
    name,
    kind,
    content
FROM
    assistant_conversation_file
WHERE
    books_id = @books_id
    AND member_id = @member_id
    AND id = @id;

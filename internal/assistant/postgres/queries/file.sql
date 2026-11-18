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
    AND conversation_id IS NULL
    AND created_at < @before;

-- name: DeleteUnsentFile :execrows
DELETE FROM assistant_conversation_file
WHERE
    books_id = @books_id
    AND member_id = @member_id
    AND conversation_id IS NULL
    AND id = @id;

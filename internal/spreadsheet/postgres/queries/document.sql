-- name: ListDocuments :many
SELECT
    id,
    name,
    version,
    created_at,
    updated_at
FROM
    spreadsheet_document
WHERE
    books_id = $1
ORDER BY
    updated_at DESC,
    id DESC;

-- name: CountDocuments :one
SELECT
    count(*)
FROM
    spreadsheet_document
WHERE
    books_id = $1;

-- name: GetDocument :one
SELECT
    *
FROM
    spreadsheet_document
WHERE
    books_id = $1
    AND id = $2;

-- name: InsertDocument :one
INSERT INTO
    spreadsheet_document (books_id, name, content)
VALUES
    (@books_id, @name, @content)
RETURNING
    *;

-- name: CopyDocument :one
INSERT INTO
    spreadsheet_document (books_id, name, content)
SELECT
    d.books_id,
    @name,
    d.content
FROM
    spreadsheet_document d
WHERE
    d.books_id = @books_id
    AND d.id = @id
RETURNING
    id,
    name,
    version,
    created_at,
    updated_at;

-- name: UpdateDocumentContent :one
UPDATE spreadsheet_document
SET
    content = @content,
    version = version + 1,
    updated_at = now()
WHERE
    books_id = @books_id
    AND id = @id
    AND version = @version
RETURNING
    id,
    name,
    version,
    created_at,
    updated_at;

-- name: RenameDocument :one
UPDATE spreadsheet_document
SET
    name = @name
WHERE
    books_id = @books_id
    AND id = @id
RETURNING
    id,
    name,
    version,
    created_at,
    updated_at;

-- name: DeleteDocument :execrows
DELETE FROM spreadsheet_document
WHERE
    books_id = $1
    AND id = $2;

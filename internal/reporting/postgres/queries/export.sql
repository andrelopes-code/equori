-- name: RequestExport :one
INSERT INTO
    reporting_export (books_id, status, requested_at, credentials)
VALUES
    (@books_id, 'pending', @requested_at, @credentials)
ON CONFLICT (books_id) DO UPDATE
SET
    id = uuidv7(),
    status = 'pending',
    requested_at = excluded.requested_at,
    finished_at = NULL,
    content = NULL,
    sha256 = NULL,
    problem = NULL,
    archive_version = NULL,
    credentials = excluded.credentials
WHERE
    reporting_export.status <> 'pending'
RETURNING
    id,
    status,
    requested_at;

-- name: GetExport :one
SELECT
    id,
    status,
    requested_at,
    finished_at,
    coalesce(octet_length(content), 0)::bigint AS size,
    sha256,
    problem,
    archive_version
FROM
    reporting_export
WHERE
    books_id = @books_id;

-- name: ExportContent :one
SELECT
    status,
    requested_at,
    content
FROM
    reporting_export
WHERE
    books_id = @books_id;

-- name: FinishExport :exec
UPDATE reporting_export
SET
    status = @status,
    finished_at = @finished_at,
    content = @content,
    sha256 = @sha256,
    problem = @problem,
    archive_version = @archive_version,
    credentials = NULL
WHERE
    books_id = @books_id
    AND id = @id
    AND status = 'pending';

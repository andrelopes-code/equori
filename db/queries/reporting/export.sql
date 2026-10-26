-- name: RequestExport :one
INSERT INTO reporting_export (user_id, status, requested_at) VALUES (@user_id, 'pending', @requested_at)
ON CONFLICT (user_id) DO UPDATE
SET id = uuidv7(), status = 'pending', requested_at = excluded.requested_at, finished_at = NULL,
    content = NULL, sha256 = NULL, problem = NULL
WHERE reporting_export.status <> 'pending'
RETURNING id, status, requested_at;

-- name: GetExport :one
SELECT id, status, requested_at, finished_at, coalesce(octet_length(content), 0)::bigint AS size, sha256, problem
FROM reporting_export WHERE user_id = @user_id;

-- name: ExportContent :one
SELECT status, requested_at, content FROM reporting_export WHERE user_id = @user_id;

-- name: FinishExport :exec
UPDATE reporting_export
SET status = @status, finished_at = @finished_at, content = @content, sha256 = @sha256, problem = @problem
WHERE user_id = @user_id AND id = @id AND status = 'pending';

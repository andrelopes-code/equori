-- name: UpsertAttachmentBlob :exec
-- DO UPDATE locks an existing blob row, so a concurrent delete of its last attachment waits.
INSERT INTO ledger_attachment_blob (user_id, sha256, size, content)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, sha256) DO UPDATE SET size = EXCLUDED.size;

-- name: UpsertAttachment :one
INSERT INTO ledger_attachment (user_id, transaction_id, sha256, file_name, media_type)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (transaction_id, sha256) DO UPDATE SET file_name = ledger_attachment.file_name
RETURNING *;

-- name: ListAttachments :many
SELECT a.*, b.size
FROM ledger_attachment a
JOIN ledger_attachment_blob b ON b.user_id = a.user_id AND b.sha256 = a.sha256
WHERE a.user_id = @user_id AND a.transaction_id = @transaction_id
  AND (sqlc.narg(after_created)::timestamptz IS NULL OR (a.created_at, a.id) > (sqlc.narg(after_created)::timestamptz, sqlc.narg(after_id)::uuid))
ORDER BY a.created_at, a.id
LIMIT @row_limit;

-- name: GetAttachmentContent :one
SELECT a.file_name, a.media_type, b.content
FROM ledger_attachment a
JOIN ledger_attachment_blob b ON b.user_id = a.user_id AND b.sha256 = a.sha256
WHERE a.user_id = $1 AND a.id = $2;

-- name: DeleteAttachment :one
DELETE FROM ledger_attachment WHERE user_id = $1 AND id = $2 RETURNING sha256;

-- name: DeleteUnreferencedBlob :exec
DELETE FROM ledger_attachment_blob b
WHERE b.user_id = $1 AND b.sha256 = $2
  AND NOT EXISTS (SELECT 1 FROM ledger_attachment a WHERE a.user_id = b.user_id AND a.sha256 = b.sha256);

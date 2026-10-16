-- name: InsertIntegration :one
INSERT INTO ingestion_integration (id, user_id, provider, name, credential_ciphertext)
VALUES (@id, @user_id, @provider, @name, @credential_ciphertext)
RETURNING *;

-- name: GetIntegration :one
SELECT * FROM ingestion_integration WHERE user_id = $1 AND id = $2;

-- name: ListIntegrations :many
SELECT * FROM ingestion_integration
WHERE user_id = @user_id
  AND (sqlc.narg(after_name)::text IS NULL OR (name, id) > (sqlc.narg(after_name)::text, sqlc.narg(after_id)::uuid))
ORDER BY name, id
LIMIT @row_limit;

-- name: UpdateCredentials :one
UPDATE ingestion_integration SET credential_ciphertext = @credential_ciphertext, updated_at = now()
WHERE user_id = @user_id AND id = @id
RETURNING *;

-- name: DeleteIntegration :execrows
DELETE FROM ingestion_integration WHERE user_id = $1 AND id = $2;

-- name: LockAllCredentials :many
-- Rotation (ADR 008 K4) reseals every user's values: the one query without a user filter.
SELECT id, user_id, credential_ciphertext FROM ingestion_integration ORDER BY id FOR UPDATE;

-- name: ResealCredentials :exec
UPDATE ingestion_integration SET credential_ciphertext = @credential_ciphertext
WHERE user_id = @user_id AND id = @id;

-- name: InsertConnection :one
INSERT INTO ingestion_connection (user_id, integration_id, external_item_id, name, provider_status, last_item_update_at)
VALUES (@user_id, @integration_id, @external_item_id, @name, @provider_status, sqlc.narg(last_item_update_at))
RETURNING *;

-- name: InsertExternalAccount :one
INSERT INTO ingestion_external_account (user_id, connection_id, external_account_id, type, subtype, name, number_last4, currency)
VALUES (@user_id, @connection_id, @external_account_id, @type, @subtype, @name, sqlc.narg(number_last4), @currency)
RETURNING *;

-- name: GetConnection :one
SELECT * FROM ingestion_connection WHERE user_id = $1 AND id = $2;

-- name: ListConnections :many
SELECT * FROM ingestion_connection
WHERE user_id = @user_id
  AND (sqlc.narg(after_name)::text IS NULL OR (name, id) > (sqlc.narg(after_name)::text, sqlc.narg(after_id)::uuid))
ORDER BY name, id
LIMIT @row_limit;

-- name: ExternalAccountsOf :many
SELECT * FROM ingestion_external_account
WHERE user_id = @user_id AND connection_id = ANY(@connection_ids::uuid[])
ORDER BY connection_id, id;

-- name: DeleteConnection :execrows
DELETE FROM ingestion_connection WHERE user_id = $1 AND id = $2;

-- name: SaveMapping :one
UPDATE ingestion_external_account SET account_id = sqlc.narg(account_id), sync_from = sqlc.narg(sync_from), ignored = @ignored
WHERE user_id = @user_id AND connection_id = @connection_id AND id = @id
RETURNING *;

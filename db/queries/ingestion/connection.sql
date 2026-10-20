-- name: InsertConnection :one
INSERT INTO ingestion_connection (user_id, integration_id, external_item_id, name, provider_status, last_item_update_at)
VALUES (@user_id, @integration_id, @external_item_id, @name, @provider_status, sqlc.narg(last_item_update_at))
RETURNING *;

-- name: InsertExternalAccount :one
INSERT INTO ingestion_external_account (user_id, connection_id, external_account_id, type, subtype, name, number_last4, currency)
VALUES (@user_id, @connection_id, @external_account_id, @type, @subtype, @name, sqlc.narg(number_last4), @currency)
RETURNING *;

-- name: InsertMissingExternalAccount :exec
INSERT INTO ingestion_external_account (user_id, connection_id, external_account_id, type, subtype, name, number_last4, currency)
VALUES (@user_id, @connection_id, @external_account_id, @type, @subtype, @name, sqlc.narg(number_last4), @currency)
ON CONFLICT (connection_id, external_account_id) DO NOTHING;

-- name: RenameExternalAccount :exec
-- A94: the previous name joins the former names; the new name leaves them.
UPDATE ingestion_external_account
SET former_names = array_remove(array_append(array_remove(former_names, name), name), @name::text), name = @name
WHERE user_id = @user_id AND id = @id AND name <> @name;

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

-- name: MarkAccountSynced :exec
UPDATE ingestion_external_account SET last_synced_on = @last_synced_on,
    balance_on = sqlc.narg(balance_on), balance_amount = sqlc.narg(balance_amount)
WHERE user_id = @user_id AND id = @id;

-- name: SaveConnectionState :exec
UPDATE ingestion_connection SET provider_status = @provider_status, last_item_update_at = sqlc.narg(last_item_update_at),
    next_item_update_at = sqlc.narg(next_item_update_at), last_synced_at = sqlc.narg(last_synced_at), last_error = sqlc.narg(last_error)
WHERE user_id = @user_id AND id = @id;

-- name: ListAllConnections :many
-- The scheduler checks every user's connections (A43); each sync then filters by its user.
SELECT id, user_id FROM ingestion_connection ORDER BY user_id, id;

-- name: AccountMapping :one
-- A103: the start and the last synced date of the account's mapping.
SELECT sync_from, last_synced_on FROM ingestion_external_account WHERE user_id = @user_id AND account_id = @account_id;

-- name: AccountFilePeriods :many
-- A103: the periods the account's imported files covered.
SELECT period_from, period_to FROM ingestion_batch
WHERE user_id = @user_id AND account_id = @account_id AND source <> 'open_finance';

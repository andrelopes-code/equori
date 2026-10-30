-- name: InsertConnection :one
INSERT INTO
    ingestion_connection (
        books_id,
        integration_id,
        external_id,
        name,
        provider_status,
        last_item_update_at
    )
VALUES
    (
        @books_id,
        @integration_id,
        @external_id,
        @name,
        @provider_status,
        sqlc.narg (last_item_update_at)
    )
RETURNING
    *;

-- name: InsertExternalAccount :one
INSERT INTO
    ingestion_external_account (
        books_id,
        connection_id,
        external_account_id,
        type,
        subtype,
        name,
        number_last4,
        currency
    )
VALUES
    (
        @books_id,
        @connection_id,
        @external_account_id,
        @type,
        @subtype,
        @name,
        sqlc.narg (number_last4),
        @currency
    )
RETURNING
    *;

-- name: InsertMissingExternalAccount :exec
INSERT INTO
    ingestion_external_account (
        books_id,
        connection_id,
        external_account_id,
        type,
        subtype,
        name,
        number_last4,
        currency
    )
VALUES
    (
        @books_id,
        @connection_id,
        @external_account_id,
        @type,
        @subtype,
        @name,
        sqlc.narg (number_last4),
        @currency
    )
ON CONFLICT (connection_id, external_account_id) DO NOTHING;

-- name: RenameExternalAccount :exec
-- A94: the previous name joins the former names; the new name leaves them.
UPDATE ingestion_external_account
SET
    former_names = array_remove(array_append(array_remove(former_names, name), name), @name::text),
    name = @name
WHERE
    books_id = @books_id
    AND id = @id
    AND name <> @name;

-- name: GetConnection :one
SELECT
    *
FROM
    ingestion_connection
WHERE
    books_id = $1
    AND id = $2;

-- name: ListConnections :many
SELECT
    *
FROM
    ingestion_connection
WHERE
    books_id = @books_id
    AND (
        sqlc.narg (after_name)::text IS NULL
        OR (name, id) > (sqlc.narg (after_name)::text, sqlc.narg (after_id)::uuid)
    )
ORDER BY
    name,
    id
LIMIT
    @row_limit;

-- name: ExternalAccountsOf :many
SELECT
    *
FROM
    ingestion_external_account
WHERE
    books_id = @books_id
    AND connection_id = ANY (@connection_ids::UUID[])
ORDER BY
    connection_id,
    id;

-- name: DeleteConnection :execrows
DELETE FROM ingestion_connection
WHERE
    books_id = $1
    AND id = $2;

-- name: SaveMapping :one
UPDATE ingestion_external_account
SET
    account_id = sqlc.narg (account_id),
    sync_from = sqlc.narg (sync_from),
    ignored = @ignored
WHERE
    books_id = @books_id
    AND connection_id = @connection_id
    AND id = @id
RETURNING
    *;

-- name: MarkAccountSynced :exec
UPDATE ingestion_external_account
SET
    last_synced_on = @last_synced_on,
    balance_on = sqlc.narg (balance_on),
    balance_amount = sqlc.narg (balance_amount)
WHERE
    books_id = @books_id
    AND id = @id;

-- name: SaveConnectionState :exec
UPDATE ingestion_connection
SET
    provider_status = @provider_status,
    last_item_update_at = sqlc.narg (last_item_update_at),
    next_item_update_at = sqlc.narg (next_item_update_at),
    last_synced_at = sqlc.narg (last_synced_at),
    last_error = sqlc.narg (last_error)
WHERE
    books_id = @books_id
    AND id = @id;

-- name: ListAllConnections :many
-- The scheduler checks every user's connections (A43); each sync then filters by its user.
SELECT
    id,
    books_id
FROM
    ingestion_connection
ORDER BY
    books_id,
    id;

-- name: AccountMapping :one
-- A103: the start and the last synced date of the account's mapping.
SELECT
    sync_from,
    last_synced_on
FROM
    ingestion_external_account
WHERE
    books_id = @books_id
    AND account_id = @account_id;

-- name: AccountFilePeriods :many
-- A103: the periods the account's imported files covered.
SELECT
    period_from,
    period_to
FROM
    ingestion_batch
WHERE
    books_id = @books_id
    AND account_id = @account_id
    AND source <> 'aggregator';

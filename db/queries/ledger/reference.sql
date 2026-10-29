-- name: GetSettings :one
SELECT
    *
FROM
    ledger_settings
WHERE
    user_id = $1;

-- name: UpsertSettings :exec
INSERT INTO
    ledger_settings (user_id, base_currency)
VALUES
    ($1, $2)
ON CONFLICT (user_id) DO UPDATE
SET
    base_currency = EXCLUDED.base_currency;

-- name: InsertInstitution :one
INSERT INTO
    ledger_institution (user_id, name, code, identifier_scheme, identifier)
VALUES
    ($1, $2, $3, $4, $5)
RETURNING
    *;

-- name: SetInstitutionIdentifier :one
UPDATE ledger_institution
SET
    identifier_scheme = sqlc.narg (identifier_scheme),
    identifier = sqlc.narg (identifier)
WHERE
    user_id = @user_id
    AND id = @id
RETURNING
    *;

-- name: ListInstitutions :many
SELECT
    *,
    lower(name)::text AS sort_name
FROM
    ledger_institution
WHERE
    user_id = @user_id
    AND (
        sqlc.narg (after_name)::text IS NULL
        OR (lower(name), id) > (sqlc.narg (after_name)::text, sqlc.narg (after_id)::uuid)
    )
ORDER BY
    lower(name),
    id
LIMIT
    @row_limit;

-- name: InsertPayee :one
INSERT INTO
    ledger_payee (user_id, name)
VALUES
    ($1, $2)
RETURNING
    *;

-- name: GetPayee :one
SELECT
    *
FROM
    ledger_payee
WHERE
    user_id = $1
    AND id = $2;

-- name: PayeeNames :many
SELECT
    id,
    name
FROM
    ledger_payee
WHERE
    user_id = @user_id
    AND id = ANY (@ids::UUID[]);

-- name: ListPayees :many
SELECT
    *,
    lower(name)::text AS sort_name
FROM
    ledger_payee
WHERE
    user_id = @user_id
    AND merged_into IS NULL
    AND (
        sqlc.narg (after_name)::text IS NULL
        OR (lower(name), id) > (sqlc.narg (after_name)::text, sqlc.narg (after_id)::uuid)
    )
ORDER BY
    lower(name),
    id
LIMIT
    @row_limit;

-- name: RenamePayee :one
UPDATE ledger_payee
SET
    name = @name
WHERE
    user_id = @user_id
    AND id = @id
RETURNING
    *;

-- name: MarkPayeeMerged :exec
UPDATE ledger_payee
SET
    merged_into = @into_id
WHERE
    user_id = @user_id
    AND id = @from_id;

-- name: TransactionsWithPayee :many
-- A82: the non-voided transactions of the payee, by id.
SELECT
    id
FROM
    ledger_transaction
WHERE
    user_id = @user_id
    AND payee_id = @payee_id
    AND voided_at IS NULL
ORDER BY
    id;

-- name: MoveVoidedPayee :exec
UPDATE ledger_transaction
SET
    payee_id = @into_id
WHERE
    user_id = @user_id
    AND payee_id = @from_id
    AND voided_at IS NOT NULL;

-- name: MoveCounterpartyPayee :exec
UPDATE ledger_account
SET
    counterparty_payee_id = @into_id,
    updated_at = now()
WHERE
    user_id = @user_id
    AND counterparty_payee_id = @from_id;

-- name: UpsertTag :one
INSERT INTO
    ledger_tag (user_id, name)
VALUES
    ($1, $2)
ON CONFLICT (user_id, name) DO UPDATE
SET
    name = EXCLUDED.name
RETURNING
    id;

-- name: ListTags :many
SELECT
    name
FROM
    ledger_tag
WHERE
    user_id = @user_id
    AND (
        sqlc.narg (after_name)::text IS NULL
        OR name > sqlc.narg (after_name)::text
    )
ORDER BY
    name
LIMIT
    @row_limit;

-- name: GetTagUsage :one
SELECT
    g.id,
    g.name,
    count(t.id)::int AS transactions
FROM
    ledger_tag g
    LEFT JOIN ledger_transaction_tag tt ON tt.tag_id = g.id
    LEFT JOIN ledger_transaction t ON t.id = tt.transaction_id
    AND t.voided_at IS NULL
WHERE
    g.user_id = @user_id
    AND g.name = @name
GROUP BY
    g.id,
    g.name;

-- name: RenameTag :one
UPDATE ledger_tag
SET
    name = @new_name
WHERE
    user_id = @user_id
    AND id = @id
RETURNING
    id;

-- name: TransactionsWithTag :many
SELECT
    tt.transaction_id
FROM
    ledger_transaction_tag tt
    JOIN ledger_transaction t ON t.id = tt.transaction_id
WHERE
    tt.user_id = @user_id
    AND tt.tag_id = @tag_id
    AND t.voided_at IS NULL
ORDER BY
    tt.transaction_id;

-- name: MoveTagLinks :exec
-- Voided transactions keep their version and name the destination in place.
INSERT INTO
    ledger_transaction_tag (user_id, transaction_id, tag_id)
SELECT
    l.user_id,
    l.transaction_id,
    @into_id::uuid
FROM
    ledger_transaction_tag l
WHERE
    l.user_id = @user_id
    AND l.tag_id = @from_id
ON CONFLICT DO NOTHING;

-- name: DeleteTag :exec
DELETE FROM ledger_tag
WHERE
    user_id = @user_id
    AND id = @id;

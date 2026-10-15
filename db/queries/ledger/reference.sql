-- name: GetSettings :one
SELECT * FROM ledger_settings WHERE user_id = $1;

-- name: UpsertSettings :exec
INSERT INTO ledger_settings (user_id, base_currency) VALUES ($1, $2)
ON CONFLICT (user_id) DO UPDATE SET base_currency = EXCLUDED.base_currency;

-- name: InsertInstitution :one
INSERT INTO ledger_institution (user_id, name, code) VALUES ($1, $2, $3) RETURNING *;

-- name: ListInstitutions :many
SELECT * FROM ledger_institution WHERE user_id = $1 ORDER BY lower(name);

-- name: InsertPayee :one
INSERT INTO ledger_payee (user_id, name) VALUES ($1, $2) RETURNING *;

-- name: GetPayee :one
SELECT * FROM ledger_payee WHERE user_id = $1 AND id = $2;

-- name: ListPayees :many
SELECT * FROM ledger_payee WHERE user_id = $1 ORDER BY lower(name);

-- name: UpsertTag :one
INSERT INTO ledger_tag (user_id, name) VALUES ($1, $2)
ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
RETURNING id;

-- name: ListTags :many
SELECT name FROM ledger_tag WHERE user_id = $1 ORDER BY name;

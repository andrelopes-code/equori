-- name: ListRules :many
SELECT * FROM classification_rule
WHERE user_id = @user_id
  AND (sqlc.narg(after_priority)::int IS NULL OR priority > sqlc.narg(after_priority)::int)
ORDER BY priority
LIMIT @row_limit;

-- name: EnabledRules :many
SELECT * FROM classification_rule WHERE user_id = $1 AND enabled ORDER BY priority;

-- name: RuleIDs :many
SELECT id FROM classification_rule WHERE user_id = $1 ORDER BY priority FOR UPDATE;

-- name: GetRule :one
SELECT * FROM classification_rule WHERE user_id = $1 AND id = $2;

-- name: InsertRule :one
-- A new rule takes the last priority.
INSERT INTO classification_rule (user_id, name, priority, enabled, stop_processing, conditions, actions, schema_version)
VALUES (@user_id, @name, (SELECT coalesce(max(priority), 0) + 1 FROM classification_rule WHERE user_id = @user_id),
        @enabled, @stop_processing, @conditions, @actions, 1)
RETURNING *;

-- name: UpdateRule :one
UPDATE classification_rule
SET name = @name, enabled = @enabled, stop_processing = @stop_processing, conditions = @conditions, actions = @actions, updated_at = now()
WHERE user_id = @user_id AND id = @id
RETURNING *;

-- name: DeleteRule :execrows
DELETE FROM classification_rule WHERE user_id = $1 AND id = $2;

-- name: SetRulePriority :exec
UPDATE classification_rule SET priority = @priority, updated_at = now() WHERE user_id = @user_id AND id = @id;

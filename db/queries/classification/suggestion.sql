-- name: CorrectedExamples :many
SELECT transaction_id FROM classification_categorization
WHERE user_id = @user_id AND match_key = @match_key AND category_id = @category_id AND corrected AND NOT voided
ORDER BY transaction_date, transaction_id
LIMIT @row_limit;

-- name: UpsertSuggestion :exec
-- P5 amendment A24: one suggestion per fingerprint; only a pending one gains examples.
INSERT INTO classification_suggestion (user_id, fingerprint, conditions, actions, example_transaction_ids, state, created_at)
VALUES (@user_id, @fingerprint, @conditions, @actions, @example_transaction_ids, 'pending', @created_at)
ON CONFLICT (user_id, fingerprint) DO UPDATE SET example_transaction_ids = EXCLUDED.example_transaction_ids
WHERE classification_suggestion.state = 'pending';

-- name: ListSuggestions :many
SELECT * FROM classification_suggestion
WHERE user_id = @user_id
  AND (sqlc.narg(state)::text IS NULL OR state = sqlc.narg(state)::text)
  AND (sqlc.narg(after_id)::uuid IS NULL OR id > sqlc.narg(after_id)::uuid)
ORDER BY id
LIMIT @row_limit;

-- name: LockSuggestion :one
SELECT * FROM classification_suggestion WHERE user_id = $1 AND id = $2 FOR UPDATE;

-- name: DecideSuggestion :one
UPDATE classification_suggestion SET state = @state, rule_id = sqlc.narg(rule_id), decided_at = now()
WHERE user_id = @user_id AND id = @id
RETURNING *;

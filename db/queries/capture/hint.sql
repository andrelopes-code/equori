-- name: CategoryHints :many
SELECT
    class,
    description,
    category_id,
    answered_at
FROM
    capture_category_hint
WHERE
    user_id = @user_id
    AND description = ANY (@descriptions::TEXT[]);

-- name: SaveCategoryHint :exec
INSERT INTO
    capture_category_hint (user_id, class, description, category_id, answered_at)
VALUES
    (@user_id, @class, @description, sqlc.narg (category_id), @answered_at)
ON CONFLICT (user_id, class, description) DO UPDATE
SET
    category_id = EXCLUDED.category_id,
    answered_at = EXCLUDED.answered_at;

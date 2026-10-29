-- name: CountSourceCategory :exec
-- A line carried the category: count it and keep the aggregator's latest name.
INSERT INTO
    classification_source_category (user_id, aggregator, external_id, name, seen_count)
VALUES
    (@user_id, @aggregator, @external_id, @name, @seen)
ON CONFLICT (user_id, aggregator, external_id) DO UPDATE
SET
    seen_count = classification_source_category.seen_count + EXCLUDED.seen_count,
    name = CASE
        WHEN EXCLUDED.name = '' THEN classification_source_category.name
        ELSE EXCLUDED.name
    END;

-- name: MappedSourceCategories :many
SELECT
    external_id,
    category_id::uuid AS category_id
FROM
    classification_source_category
WHERE
    user_id = @user_id
    AND aggregator = @aggregator
    AND external_id = ANY (@external_ids::TEXT[])
    AND category_id IS NOT NULL;

-- name: ListSourceCategories :many
SELECT
    *
FROM
    classification_source_category
WHERE
    user_id = @user_id
    AND (
        sqlc.narg (after_name)::text IS NULL
        OR (name, id) > (sqlc.narg (after_name)::text, sqlc.narg (after_id)::uuid)
    )
ORDER BY
    name,
    id
LIMIT
    @row_limit;

-- name: MapSourceCategory :one
UPDATE classification_source_category
SET
    category_id = sqlc.narg (category_id)
WHERE
    user_id = @user_id
    AND id = @id
RETURNING
    *;

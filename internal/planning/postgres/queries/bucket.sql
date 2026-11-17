-- name: ListBucketMethods :many
SELECT
    effective_from
FROM
    planning_bucket_method
WHERE
    books_id = @books_id
ORDER BY
    effective_from;

-- name: ListBuckets :many
SELECT
    id,
    effective_from,
    lineage_id,
    name,
    share_bp,
    takes_savings,
    takes_goals,
    at_least
FROM
    planning_bucket
WHERE
    books_id = @books_id
ORDER BY
    effective_from,
    position;

-- name: ListBucketCategories :many
SELECT
    bucket_id,
    category_id
FROM
    planning_bucket_category
WHERE
    books_id = @books_id
ORDER BY
    category_id;

-- name: DeleteBucketMethod :execrows
DELETE FROM planning_bucket_method
WHERE
    books_id = @books_id
    AND effective_from = @effective_from;

-- name: InsertBucketMethod :exec
INSERT INTO
    planning_bucket_method (books_id, effective_from)
VALUES
    (@books_id, @effective_from);

-- name: InsertBucket :one
INSERT INTO
    planning_bucket (
        books_id,
        effective_from,
        lineage_id,
        position,
        name,
        share_bp,
        takes_savings,
        takes_goals,
        at_least
    )
VALUES
    (
        @books_id,
        @effective_from,
        @lineage_id,
        @position,
        @name,
        @share_bp,
        @takes_savings,
        @takes_goals,
        @at_least
    )
RETURNING
    id;

-- name: InsertBucketCategory :exec
INSERT INTO
    planning_bucket_category (books_id, effective_from, category_id, bucket_id)
VALUES
    (@books_id, @effective_from, @category_id, @bucket_id);

-- name: ListBuckets :many
SELECT
    id,
    name,
    share_bp,
    takes_savings
FROM
    planning_bucket
WHERE
    books_id = @books_id
ORDER BY
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

-- name: DeleteBuckets :exec
DELETE FROM planning_bucket
WHERE
    books_id = @books_id;

-- name: InsertBucket :one
INSERT INTO
    planning_bucket (books_id, position, name, share_bp, takes_savings)
VALUES
    (@books_id, @position, @name, @share_bp, @takes_savings)
RETURNING
    id;

-- name: InsertBucketCategory :exec
INSERT INTO
    planning_bucket_category (books_id, category_id, bucket_id)
VALUES
    (@books_id, @category_id, @bucket_id);

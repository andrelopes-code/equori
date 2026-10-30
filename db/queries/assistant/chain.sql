-- name: ListChainTargets :many
SELECT
    *
FROM
    assistant_chain_target
WHERE
    books_id = $1
ORDER BY
    use_id,
    position;

-- name: DeleteChain :exec
DELETE FROM assistant_chain_target
WHERE
    books_id = $1
    AND use_id = $2;

-- name: InsertChainTarget :exec
INSERT INTO
    assistant_chain_target (books_id, use_id, position, provider_id, model, capabilities)
VALUES
    (@books_id, @use_id, @position, @provider_id, @model, @capabilities);

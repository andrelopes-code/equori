-- name: ClaimRebuildVersion :execrows
-- One row when the stored version differs from the given one: the caller rebuilds. Concurrent
-- starts of one version wait on the row lock and claim nothing.
INSERT INTO
    portfolio_rebuild_state (version)
VALUES
    (sqlc.arg (version))
ON CONFLICT (id) DO UPDATE
SET
    version = EXCLUDED.version
WHERE
    portfolio_rebuild_state.version <> EXCLUDED.version;

-- name: ForgetRebuildVersion :exec
DELETE FROM portfolio_rebuild_state;

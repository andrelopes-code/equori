-- name: GetSettings :one
SELECT
    update_check,
    copy_password,
    copy_state,
    copy_attempt_at,
    copy_at,
    copy_file
FROM
    instance_settings;

-- name: SetCopyPassword :exec
INSERT INTO
    instance_settings (copy_password)
VALUES
    (@copy_password)
ON CONFLICT (id) DO UPDATE
SET
    copy_password = EXCLUDED.copy_password;

-- name: SaveCopyAttempt :exec
-- copy_at and copy_file keep the last successful copy when the attempt brings none.
INSERT INTO
    instance_settings (copy_state, copy_attempt_at, copy_at, copy_file)
VALUES
    (@copy_state, @copy_attempt_at, sqlc.narg (copy_at), sqlc.narg (copy_file))
ON CONFLICT (id) DO UPDATE
SET
    copy_state = EXCLUDED.copy_state,
    copy_attempt_at = EXCLUDED.copy_attempt_at,
    copy_at = coalesce(EXCLUDED.copy_at, instance_settings.copy_at),
    copy_file = coalesce(EXCLUDED.copy_file, instance_settings.copy_file);

-- name: SetUpdateCheck :exec
INSERT INTO
    instance_settings (update_check)
VALUES
    (@update_check)
ON CONFLICT (id) DO UPDATE
SET
    update_check = EXCLUDED.update_check;

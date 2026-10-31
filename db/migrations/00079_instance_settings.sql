-- +goose Up
-- P13: settings of the whole instance; at most one row, no row means every default.
CREATE TABLE instance_settings (
    id              boolean     PRIMARY KEY DEFAULT true CHECK (id),
    -- A159: null until an admin answers.
    update_check    boolean,
    -- A155: sealed with the instance secret key (ADR 008).
    copy_password   bytea,
    copy_state      text        NOT NULL DEFAULT 'password_unset'
        CHECK (copy_state IN ('folder_unset', 'password_unset', 'ok', 'folder_not_writable', 'failed')),
    copy_attempt_at timestamptz,
    copy_at         timestamptz,
    copy_file       text
);

-- +goose Down
DROP TABLE instance_settings;

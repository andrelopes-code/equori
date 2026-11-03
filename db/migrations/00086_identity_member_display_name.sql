-- +goose Up
-- A member chooses a display name; a member without one shows the email.
ALTER TABLE identity_member
    ADD COLUMN display_name text CHECK (
        display_name IS NULL
        OR (char_length(display_name) BETWEEN 1 AND 60 AND display_name !~ '[[:cntrl:]]')
    );

-- +goose Down
ALTER TABLE identity_member DROP COLUMN display_name;

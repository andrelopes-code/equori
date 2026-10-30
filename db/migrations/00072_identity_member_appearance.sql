-- +goose Up
-- ADR 029 BK21: appearance follows the member; the web validates each value on read.
ALTER TABLE identity_member
    ADD COLUMN appearance jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(appearance) = 'object');

-- +goose Down
ALTER TABLE identity_member DROP COLUMN appearance;

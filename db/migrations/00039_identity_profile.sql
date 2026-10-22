-- +goose Up
ALTER TABLE identity_user
    ADD COLUMN language text NOT NULL DEFAULT 'pt' CHECK (language ~ '^[a-z]{2,3}$'),
    ADD COLUMN region   text NOT NULL DEFAULT 'BR' CHECK (region ~ '^[A-Z]{2}$');
ALTER TABLE identity_user ALTER COLUMN language DROP DEFAULT, ALTER COLUMN region DROP DEFAULT;
-- +goose Down
ALTER TABLE identity_user DROP COLUMN language, DROP COLUMN region;

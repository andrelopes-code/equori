-- +goose Up
-- A83: a category's colour is a data slot of the theme (1-8) and its icon a kebab-case key of
-- the curated icon set of api/openapi.yaml (CategoryIcon).
ALTER TABLE ledger_account
    ADD COLUMN color smallint CONSTRAINT ledger_account_color_check CHECK (color BETWEEN 1 AND 8),
    ADD COLUMN icon text CONSTRAINT ledger_account_icon_check CHECK (icon ~ '^[a-z0-9-]{1,40}$');

-- +goose Down
ALTER TABLE ledger_account DROP COLUMN icon, DROP COLUMN color;

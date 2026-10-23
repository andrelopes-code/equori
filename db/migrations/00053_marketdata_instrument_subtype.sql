-- +goose Up
-- Investments design 4.1: a subtype refines the type of a security (cri, cdb, equity_fund); the
-- jurisdiction of the owner reads it to derive the tax class. The value set grows with regions,
-- so the column holds an identifier and no list (ADR 016, X7).
ALTER TABLE marketdata_instrument ADD COLUMN subtype text
    CHECK (subtype IS NULL OR subtype ~ '^[a-z0-9_]{2,40}$');

-- +goose Down
ALTER TABLE marketdata_instrument DROP COLUMN subtype;

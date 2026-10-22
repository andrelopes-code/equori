-- +goose Up
-- Regional neutrality spec 5.8: the foreign purchase charge (IOF in Brazil) becomes a per-card rate; existing cards keep 350.
ALTER TABLE ledger_card ADD COLUMN foreign_charge_bp int NOT NULL DEFAULT 350 CHECK (foreign_charge_bp BETWEEN 0 AND 10000);
ALTER TABLE ledger_card ALTER COLUMN foreign_charge_bp DROP DEFAULT;

-- +goose Down
ALTER TABLE ledger_card DROP COLUMN foreign_charge_bp;

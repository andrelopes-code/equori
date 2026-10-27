-- +goose Up
-- Analytics design 4.3: an asset account left out of the liquidity indicator.
ALTER TABLE ledger_account ADD COLUMN excluded_from_liquidity boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE ledger_account DROP COLUMN excluded_from_liquidity;

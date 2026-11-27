-- +goose Up
-- Foreign cash design FC5 and FC13: the rate of a trade or an income paid in a currency other than
-- the base; null when the cash is in the base currency.
ALTER TABLE ledger_trade ADD COLUMN exchange_rate numeric(30, 12) CHECK (exchange_rate > 0);
ALTER TABLE ledger_investment_income ADD COLUMN exchange_rate numeric(30, 12) CHECK (exchange_rate > 0);

-- +goose Down
ALTER TABLE ledger_investment_income DROP COLUMN exchange_rate;
ALTER TABLE ledger_trade DROP COLUMN exchange_rate;

-- +goose Up
-- Investment history design OL1 and OL8: a trade of side opening records units held before the
-- book at their cost, against the opening balances, without cash.
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_side_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_side_check
    CHECK (side IN ('buy', 'sell', 'write_off', 'opening'));
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_opening
    CHECK (side <> 'opening' OR (taxes = 0 AND cash_account_id = account_id));

-- +goose Down
DELETE FROM ledger_transaction t USING ledger_trade d
WHERE d.side = 'opening' AND t.books_id = d.books_id AND t.id = d.transaction_id;
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_opening;
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_side_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_side_check
    CHECK (side IN ('buy', 'sell', 'write_off'));

-- +goose Up
-- A228 IO14: the day-trade part of a sale, fixed with its cost (A69).
ALTER TABLE ledger_trade
    ADD COLUMN day_trade_quantity bigint NOT NULL DEFAULT 0,
    ADD COLUMN day_trade_cost bigint NOT NULL DEFAULT 0,
    ADD CONSTRAINT ledger_trade_day_trade_check CHECK (
        day_trade_quantity >= 0
        AND day_trade_quantity <= quantity
        AND day_trade_cost >= 0
        AND day_trade_cost <= coalesce(cost, 0)
        AND (side = 'sell' OR (day_trade_quantity = 0 AND day_trade_cost = 0))
    );

-- A228 IO15: a sale gives one result per kind.
ALTER TABLE portfolio_realized_result
    ADD COLUMN kind text NOT NULL DEFAULT 'swing' CHECK (kind IN ('swing', 'day_trade'));

ALTER TABLE portfolio_realized_result DROP CONSTRAINT portfolio_realized_result_pkey;

ALTER TABLE portfolio_realized_result ADD PRIMARY KEY (transaction_id, kind);

-- +goose Down
DELETE FROM portfolio_realized_result WHERE kind = 'day_trade';

ALTER TABLE portfolio_realized_result DROP CONSTRAINT portfolio_realized_result_pkey;

ALTER TABLE portfolio_realized_result ADD PRIMARY KEY (transaction_id);

ALTER TABLE portfolio_realized_result DROP COLUMN kind;

ALTER TABLE ledger_trade
    DROP CONSTRAINT ledger_trade_day_trade_check,
    DROP COLUMN day_trade_cost,
    DROP COLUMN day_trade_quantity;

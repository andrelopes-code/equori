-- +goose Up
-- D1 detail of a trade transaction (P8 amendment A68); cost is the cost basis a sale removes.
CREATE TABLE ledger_trade (
    transaction_id  uuid            NOT NULL,
    user_id         bigint          NOT NULL,
    account_id      uuid            NOT NULL,
    cash_account_id uuid            NOT NULL,
    side            text            NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity        bigint          NOT NULL CHECK (quantity > 0),
    unit_price      numeric(30, 12) NOT NULL CHECK (unit_price > 0),
    gross           bigint          NOT NULL CHECK (gross > 0),
    fees            bigint          NOT NULL CHECK (fees >= 0),
    taxes           bigint          NOT NULL CHECK (taxes >= 0),
    cost            bigint          CHECK (cost > 0),
    currency        text            NOT NULL REFERENCES marketdata_instrument (code),
    PRIMARY KEY (transaction_id),
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id),
    FOREIGN KEY (user_id, cash_account_id) REFERENCES ledger_account (user_id, id),
    CHECK ((side = 'sell') = (cost IS NOT NULL)),
    CHECK (side = 'sell' OR taxes = 0)
);

CREATE INDEX ledger_trade_account ON ledger_trade (account_id, side);

-- +goose Down
DROP TABLE ledger_trade;

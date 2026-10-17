-- +goose Up
-- D1 detail of an investment income transaction (P8 amendment A70).
CREATE TABLE ledger_investment_income (
    transaction_id  uuid   NOT NULL,
    user_id         bigint NOT NULL,
    account_id      uuid   NOT NULL,
    cash_account_id uuid   NOT NULL,
    income_type     text   NOT NULL CHECK (income_type IN ('dividend', 'jcp', 'interest', 'coupon')),
    gross           bigint NOT NULL CHECK (gross > 0),
    withheld        bigint NOT NULL CHECK (withheld >= 0),
    currency        text   NOT NULL REFERENCES marketdata_instrument (code),
    PRIMARY KEY (transaction_id),
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id),
    FOREIGN KEY (user_id, cash_account_id) REFERENCES ledger_account (user_id, id),
    CHECK (withheld < gross)
);

-- +goose Down
DROP TABLE ledger_investment_income;

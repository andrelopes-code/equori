-- +goose Up
-- Derived from Ledger facts and rebuilt per brokerage on each transaction event (P8 amendment A71).
CREATE TABLE portfolio_position_day (
    user_id    bigint NOT NULL,
    account_id uuid   NOT NULL,
    instrument text   NOT NULL REFERENCES marketdata_instrument (code),
    date       date   NOT NULL,
    quantity   bigint NOT NULL,
    cost_basis bigint NOT NULL,
    PRIMARY KEY (account_id, date),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id)
);

CREATE INDEX portfolio_position_day_user ON portfolio_position_day (user_id, date);

CREATE TABLE portfolio_realized_result (
    user_id        bigint NOT NULL,
    transaction_id uuid   NOT NULL,
    account_id     uuid   NOT NULL,
    instrument     text   NOT NULL REFERENCES marketdata_instrument (code),
    date           date   NOT NULL,
    month          date   NOT NULL CHECK (extract(day FROM month) = 1),
    quantity       bigint NOT NULL CHECK (quantity > 0),
    cost           bigint NOT NULL,
    proceeds       bigint NOT NULL,
    result         bigint NOT NULL,
    tax_class      text   NOT NULL,
    currency       text   NOT NULL REFERENCES marketdata_instrument (code),
    PRIMARY KEY (transaction_id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id),
    CHECK (result = proceeds - cost)
);

CREATE INDEX portfolio_realized_result_user ON portfolio_realized_result (user_id, date);

CREATE TABLE portfolio_income_event (
    user_id        bigint NOT NULL,
    transaction_id uuid   NOT NULL,
    account_id     uuid   NOT NULL,
    instrument     text   NOT NULL REFERENCES marketdata_instrument (code),
    date           date   NOT NULL,
    income_type    text   NOT NULL CHECK (income_type IN ('dividend', 'jcp', 'interest', 'coupon')),
    tax_treatment  text   NOT NULL CHECK (tax_treatment IN ('exempt', 'exclusive')),
    gross          bigint NOT NULL,
    withheld       bigint NOT NULL,
    currency       text   NOT NULL REFERENCES marketdata_instrument (code),
    PRIMARY KEY (transaction_id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id)
);

CREATE INDEX portfolio_income_event_user ON portfolio_income_event (user_id, date);

-- +goose Down
DROP TABLE portfolio_income_event;
DROP TABLE portfolio_realized_result;
DROP TABLE portfolio_position_day;

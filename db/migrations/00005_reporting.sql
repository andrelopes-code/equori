-- +goose Up
-- Derived daily balance series (B02, B08); rebuilt from ledger_posting at any time.
CREATE TABLE reporting_account_day (
    user_id         bigint NOT NULL,
    account_id      uuid   NOT NULL,
    date            date   NOT NULL,
    delta_booked    bigint NOT NULL,
    delta_settled   bigint NOT NULL,
    balance_booked  bigint NOT NULL,
    balance_settled bigint NOT NULL,
    PRIMARY KEY (account_id, date),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE reporting_account_day;

-- +goose Up
CREATE TABLE portfolio_projection_plan (
    books_id           bigint   NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    member_id          bigint   NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE,
    withdrawal_age     smallint NOT NULL CHECK (withdrawal_age BETWEEN 18 AND 100),
    last_age           smallint NOT NULL CHECK (last_age <= 120),
    real_return_bp     integer  NOT NULL CHECK (real_return_bp BETWEEN -1000 AND 3000),
    inflation_bp       integer  NOT NULL CHECK (inflation_bp BETWEEN 0 AND 5000),
    withdrawal_mode    text     NOT NULL CHECK (withdrawal_mode IN ('income', 'rate')),
    income             bigint   CHECK (income > 0),
    withdrawal_rate_bp integer  CHECK (withdrawal_rate_bp BETWEEN 1 AND 2000),
    currency           text     NOT NULL REFERENCES marketdata_instrument (code),
    baseline_date      date     NOT NULL,
    baseline_value     bigint   NOT NULL,
    PRIMARY KEY (books_id, member_id),
    CHECK (last_age > withdrawal_age),
    CHECK ((withdrawal_mode = 'income') = (income IS NOT NULL)),
    CHECK ((withdrawal_mode = 'rate') = (withdrawal_rate_bp IS NOT NULL))
);

CREATE TABLE portfolio_projection_change (
    books_id  bigint NOT NULL,
    member_id bigint NOT NULL,
    month     date   NOT NULL CHECK (month = date_trunc('month', month)::date),
    amount    bigint NOT NULL CHECK (amount >= 0),
    PRIMARY KEY (books_id, member_id, month),
    FOREIGN KEY (books_id, member_id)
        REFERENCES portfolio_projection_plan (books_id, member_id) ON DELETE CASCADE
);

ALTER TABLE identity_member
    ADD COLUMN birth_date date CHECK (birth_date >= DATE '1900-01-01');

-- +goose Down
ALTER TABLE identity_member DROP COLUMN birth_date;
DROP TABLE portfolio_projection_change;
DROP TABLE portfolio_projection_plan;

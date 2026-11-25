-- +goose Up
-- PJ8: the other incomes of a plan, ordered by position.
CREATE TABLE portfolio_projection_income (
    books_id  bigint   NOT NULL,
    member_id bigint   NOT NULL,
    position  smallint NOT NULL CHECK (position BETWEEN 1 AND 20),
    name      text     NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    amount    bigint   NOT NULL CHECK (amount > 0),
    start_age smallint NOT NULL CHECK (start_age BETWEEN 18 AND 120),
    end_age   smallint CHECK (end_age <= 120),
    PRIMARY KEY (books_id, member_id, position),
    FOREIGN KEY (books_id, member_id)
        REFERENCES portfolio_projection_plan (books_id, member_id) ON DELETE CASCADE,
    CHECK (end_age > start_age)
);

-- +goose Down
DROP TABLE portfolio_projection_income;

-- +goose Up
-- Investment history design LO1: the loss of a pool of the monthly tax carried into a month from
-- before the book's history, typed by the person.
CREATE TABLE portfolio_opening_loss (
    books_id bigint NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    pool text NOT NULL CHECK (pool ~ '^[a-z0-9_]{2,40}$'),
    month date NOT NULL CHECK (extract(day FROM month) = 1),
    amount bigint NOT NULL CHECK (amount > 0),
    PRIMARY KEY (books_id, pool)
);

-- +goose Down
DROP TABLE portfolio_opening_loss;

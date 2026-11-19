-- +goose Up
-- The books_id of an answer reaches identity_books through its class, as the question's does
-- (ADR 003, ADR 029).
ALTER TABLE portfolio_contribution_answer
    ADD FOREIGN KEY (books_id, class_id)
    REFERENCES portfolio_contribution_class (books_id, id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE portfolio_contribution_answer
    DROP CONSTRAINT portfolio_contribution_answer_books_id_class_id_fkey;

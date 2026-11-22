-- +goose Up
-- Contribution fact questions FQ9: the fact a question names; null for a question the investor
-- answers.
ALTER TABLE portfolio_contribution_question
    ADD COLUMN fact text NULL CHECK (fact ~ '^[a-z0-9_]{2,40}$');

CREATE UNIQUE INDEX portfolio_contribution_question_fact ON portfolio_contribution_question (class_id, fact)
WHERE
    fact IS NOT NULL;

-- +goose Down
DROP INDEX portfolio_contribution_question_fact;

ALTER TABLE portfolio_contribution_question
    DROP COLUMN fact;

-- +goose Up
-- Contribution criteria AC15: the limit of a question whose fact compares a figure with it, and
-- up to twenty questions a group.
ALTER TABLE portfolio_contribution_question
    ADD COLUMN limit_value numeric(10, 4),
    ADD CONSTRAINT portfolio_contribution_question_limit CHECK (limit_value IS NULL OR fact IS NOT NULL),
    DROP CONSTRAINT portfolio_contribution_question_position_check,
    ADD CONSTRAINT portfolio_contribution_question_position_check CHECK (position BETWEEN 0 AND 19);

-- +goose Down
DELETE FROM portfolio_contribution_question
WHERE
    position > 9;

ALTER TABLE portfolio_contribution_question
    DROP CONSTRAINT portfolio_contribution_question_position_check,
    ADD CONSTRAINT portfolio_contribution_question_position_check CHECK (position BETWEEN 0 AND 9),
    DROP CONSTRAINT portfolio_contribution_question_limit,
    DROP COLUMN limit_value;

-- +goose Up
-- Contribution questions CQ2, CQ4: an answer to a question with a fact may be blank. A stored no to
-- such a question is the value the editor wrote before the investor answered, so it turns blank.
ALTER TABLE portfolio_contribution_answer
    ALTER COLUMN yes DROP NOT NULL;

UPDATE portfolio_contribution_answer AS a
SET
    yes = NULL
FROM
    portfolio_contribution_question AS q
WHERE
    q.class_id = a.class_id
    AND q.position = a.question_position
    AND q.fact IS NOT NULL
    AND NOT a.yes;

-- +goose Down
UPDATE portfolio_contribution_answer
SET
    yes = FALSE
WHERE
    yes IS NULL;

ALTER TABLE portfolio_contribution_answer
    ALTER COLUMN yes SET NOT NULL;

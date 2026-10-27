-- +goose Up
-- MCP and assistant design E11: a turn whose request context ended stores a canceled answer.
ALTER TABLE assistant_message DROP CONSTRAINT assistant_message_outcome_check;
ALTER TABLE assistant_message ADD CONSTRAINT assistant_message_outcome_check
    CHECK (outcome IN ('answered', 'step_limit', 'failed', 'canceled'));

-- +goose Down
DELETE FROM assistant_message WHERE outcome = 'canceled';
ALTER TABLE assistant_message DROP CONSTRAINT assistant_message_outcome_check;
ALTER TABLE assistant_message ADD CONSTRAINT assistant_message_outcome_check
    CHECK (outcome IN ('answered', 'step_limit', 'failed'));

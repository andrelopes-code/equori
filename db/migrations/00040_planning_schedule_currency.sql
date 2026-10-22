-- +goose Up
ALTER TABLE planning_schedule ALTER COLUMN currency DROP DEFAULT;
-- +goose Down
ALTER TABLE planning_schedule ALTER COLUMN currency SET DEFAULT 'BRL';

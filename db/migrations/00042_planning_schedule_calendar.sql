-- +goose Up
ALTER TABLE planning_schedule
    ADD COLUMN calendar text NOT NULL DEFAULT 'br_banking' CHECK (calendar ~ '^[a-z0-9_]{2,40}$');
ALTER TABLE planning_schedule ALTER COLUMN calendar DROP DEFAULT;

-- +goose Down
ALTER TABLE planning_schedule DROP COLUMN calendar;

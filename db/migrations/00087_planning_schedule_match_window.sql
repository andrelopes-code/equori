-- +goose Up
ALTER TABLE planning_schedule
    ADD COLUMN match_window_days int NOT NULL DEFAULT 7 CHECK (match_window_days BETWEEN 0 AND 31);

-- +goose Down
ALTER TABLE planning_schedule DROP COLUMN match_window_days;

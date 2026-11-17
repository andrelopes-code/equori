-- +goose Up
-- Income buckets A239 (docs/specs/2026-11-17-goal-savings-design.md): a goal whose deposits count
-- in the bucket that takes savings instead of the one that takes goals.
ALTER TABLE planning_goal
    ADD COLUMN counts_as_savings boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE planning_goal
    DROP COLUMN counts_as_savings;

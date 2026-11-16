-- +goose Up
-- Income buckets A234 (docs/specs/2026-11-15-income-buckets-design.md): a bucket whose target is a
-- floor, and the one bucket that draws what went into the goals.
ALTER TABLE planning_bucket
    ADD COLUMN at_least    boolean NOT NULL DEFAULT false,
    ADD COLUMN takes_goals boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT planning_bucket_goals_not_savings CHECK (NOT (takes_goals AND takes_savings));

CREATE UNIQUE INDEX planning_bucket_goals ON planning_bucket (books_id) WHERE takes_goals;

-- +goose Down
DROP INDEX planning_bucket_goals;
ALTER TABLE planning_bucket
    DROP CONSTRAINT planning_bucket_goals_not_savings,
    DROP COLUMN takes_goals,
    DROP COLUMN at_least;

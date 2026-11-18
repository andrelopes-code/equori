-- +goose Up
-- Planning coherence A255 (docs/specs/2026-11-17-planning-coherence-design.md): one account
-- serves several goals by amount. A link between a goal and an account is whole or allocated;
-- an allocation assigns a signed amount of an allocated account to a goal and never changes a
-- balance. A schedule may name the goal its occurrences allocate to.
ALTER TABLE planning_goal_account
    ADD COLUMN allocated boolean NOT NULL DEFAULT false;

ALTER TABLE planning_schedule
    ADD COLUMN goal_id uuid NULL,
    ADD CONSTRAINT planning_schedule_goal_fkey
        FOREIGN KEY (books_id, goal_id) REFERENCES planning_goal (books_id, id)
        ON DELETE SET NULL (goal_id);

CREATE TABLE planning_goal_allocation (
    id            uuid   NOT NULL PRIMARY KEY DEFAULT uuidv7(),
    books_id      bigint NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    goal_id       uuid   NOT NULL,
    account_id    uuid   NOT NULL,
    booked_on     date   NOT NULL,
    amount        bigint NOT NULL CHECK (amount <> 0),
    occurrence_id uuid   NULL REFERENCES planning_occurrence (id) ON DELETE CASCADE,
    FOREIGN KEY (goal_id, account_id)
        REFERENCES planning_goal_account (goal_id, account_id) ON DELETE CASCADE,
    FOREIGN KEY (books_id, goal_id) REFERENCES planning_goal (books_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX planning_goal_allocation_occurrence
    ON planning_goal_allocation (books_id, occurrence_id) WHERE occurrence_id IS NOT NULL;

CREATE INDEX planning_goal_allocation_goal ON planning_goal_allocation (books_id, goal_id);

-- +goose Down
DROP TABLE planning_goal_allocation;

ALTER TABLE planning_schedule
    DROP CONSTRAINT planning_schedule_goal_fkey,
    DROP COLUMN goal_id;

ALTER TABLE planning_goal_account
    DROP COLUMN allocated;

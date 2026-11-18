-- +goose Up
-- Planning coherence A256 (docs/specs/2026-11-17-planning-coherence-design.md): the expense
-- transactions a goal pays by a stored link. A transaction holds at most one link.
CREATE TABLE planning_goal_expense (
    books_id       bigint NOT NULL,
    transaction_id uuid   NOT NULL,
    goal_id        uuid   NOT NULL,
    PRIMARY KEY (books_id, transaction_id),
    FOREIGN KEY (books_id, goal_id) REFERENCES planning_goal (books_id, id) ON DELETE CASCADE,
    FOREIGN KEY (books_id, transaction_id)
        REFERENCES ledger_transaction (books_id, id) ON DELETE CASCADE
);

CREATE INDEX planning_goal_expense_goal ON planning_goal_expense (books_id, goal_id);

-- +goose Down
DROP TABLE planning_goal_expense;

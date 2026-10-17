-- +goose Up
-- P7 amendment A55: a target balance over one or more balance accounts by a date.
CREATE TABLE planning_goal (
    id         uuid        NOT NULL DEFAULT uuidv7(),
    user_id    bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name       text        NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    target     bigint      NOT NULL CHECK (target > 0),
    currency   text        NOT NULL,
    due_on     date        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    UNIQUE (user_id, name)
);

CREATE TABLE planning_goal_account (
    user_id    bigint NOT NULL,
    goal_id    uuid   NOT NULL,
    account_id uuid   NOT NULL,
    PRIMARY KEY (goal_id, account_id),
    FOREIGN KEY (user_id, goal_id) REFERENCES planning_goal (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id)
);

-- +goose Down
DROP TABLE planning_goal_account;
DROP TABLE planning_goal;

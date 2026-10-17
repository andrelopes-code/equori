-- +goose Up
-- P7 amendment A54: one monthly budget per category with effective-dated amounts.
CREATE TABLE planning_budget (
    id                  uuid        NOT NULL DEFAULT uuidv7(),
    user_id             bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    category_account_id uuid        NOT NULL,
    period_type         text        NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly')),
    rollover            boolean     NOT NULL,
    currency            text        NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    UNIQUE (user_id, category_account_id),
    FOREIGN KEY (user_id, category_account_id) REFERENCES ledger_account (user_id, id)
);

-- I08: one amount per budget and month.
CREATE TABLE planning_budget_amount (
    user_id        bigint NOT NULL,
    budget_id      uuid   NOT NULL,
    effective_from date   NOT NULL CHECK (extract(day FROM effective_from) = 1),
    amount         bigint NOT NULL CHECK (amount >= 0),
    PRIMARY KEY (budget_id, effective_from),
    FOREIGN KEY (user_id, budget_id) REFERENCES planning_budget (user_id, id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE planning_budget_amount;
DROP TABLE planning_budget;

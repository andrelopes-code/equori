-- +goose Up
-- Budget plan amendment A131: the reference income a user distributes across budgets.
CREATE TABLE planning_budget_reference (
    user_id  bigint NOT NULL PRIMARY KEY REFERENCES identity_user (id) ON DELETE CASCADE,
    source   text   NOT NULL CHECK (source IN ('expected_income', 'average_income', 'fixed')),
    amount   bigint CHECK (amount >= 0),
    currency text   NOT NULL,
    CHECK ((source = 'fixed') = (amount IS NOT NULL))
);

-- +goose Down
DROP TABLE planning_budget_reference;

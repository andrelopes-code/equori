-- +goose Up
-- Budget end (docs/specs/2026-11-26-budget-end-design.md, E1): a version that ends the budget
-- from its month on carries no amount.
ALTER TABLE planning_budget_amount
    ADD COLUMN ended boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT planning_budget_amount_ended_zero CHECK (NOT ended OR amount = 0);

-- +goose Down
ALTER TABLE planning_budget_amount
    DROP CONSTRAINT planning_budget_amount_ended_zero,
    DROP COLUMN ended;

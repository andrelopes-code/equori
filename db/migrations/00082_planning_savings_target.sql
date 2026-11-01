-- +goose Up
-- Savings target amendment A187: the share of the reference income a book sets aside, in basis points.
ALTER TABLE planning_budget_reference
    ADD COLUMN savings_target_bp int CHECK (savings_target_bp BETWEEN 0 AND 10000);

-- +goose Down
ALTER TABLE planning_budget_reference
    DROP COLUMN savings_target_bp;

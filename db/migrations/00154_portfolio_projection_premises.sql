-- +goose Up
-- PJ7: the premises a member may type; NULL means the plan does not hold the value.
ALTER TABLE portfolio_projection_plan
    ADD COLUMN withdrawal_return_bp integer CHECK (withdrawal_return_bp BETWEEN -1000 AND 3000),
    ADD COLUMN cautious_return_bp   integer CHECK (cautious_return_bp BETWEEN -1000 AND 3000),
    ADD COLUMN favorable_return_bp  integer CHECK (favorable_return_bp BETWEEN -1000 AND 3000),
    ADD COLUMN gain_tax_bp          integer CHECK (gain_tax_bp BETWEEN 1 AND 5000),
    ADD CONSTRAINT portfolio_projection_plan_cautious_check
        CHECK (cautious_return_bp < real_return_bp),
    ADD CONSTRAINT portfolio_projection_plan_favorable_check
        CHECK (favorable_return_bp > real_return_bp);

-- +goose Down
ALTER TABLE portfolio_projection_plan
    DROP COLUMN withdrawal_return_bp,
    DROP COLUMN cautious_return_bp,
    DROP COLUMN favorable_return_bp,
    DROP COLUMN gain_tax_bp;

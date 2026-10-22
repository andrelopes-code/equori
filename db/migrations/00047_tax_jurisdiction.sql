-- +goose Up
ALTER TABLE ledger_investment_income DROP CONSTRAINT ledger_investment_income_income_type_check;
ALTER TABLE ledger_investment_income ADD CONSTRAINT ledger_investment_income_income_type_check CHECK (income_type ~ '^[a-z0-9_]{2,40}$');

ALTER TABLE portfolio_income_event DROP CONSTRAINT portfolio_income_event_income_type_check;
ALTER TABLE portfolio_income_event DROP CONSTRAINT portfolio_income_event_tax_treatment_check;
ALTER TABLE portfolio_income_event ALTER COLUMN tax_treatment DROP NOT NULL;
ALTER TABLE portfolio_income_event ADD CONSTRAINT portfolio_income_event_income_type_check CHECK (income_type ~ '^[a-z0-9_]{2,40}$');
ALTER TABLE portfolio_income_event ADD CONSTRAINT portfolio_income_event_tax_treatment_check CHECK (tax_treatment ~ '^[a-z0-9_]{2,40}$');

ALTER TABLE portfolio_realized_result ALTER COLUMN tax_class DROP NOT NULL;
ALTER TABLE portfolio_realized_result ADD CONSTRAINT portfolio_realized_result_tax_class_check CHECK (tax_class ~ '^[a-z0-9_]{2,40}$');

-- +goose Down
ALTER TABLE portfolio_realized_result DROP CONSTRAINT portfolio_realized_result_tax_class_check;
UPDATE portfolio_realized_result SET tax_class = 'unknown' WHERE tax_class IS NULL;
ALTER TABLE portfolio_realized_result ALTER COLUMN tax_class SET NOT NULL;

ALTER TABLE portfolio_income_event DROP CONSTRAINT portfolio_income_event_tax_treatment_check;
ALTER TABLE portfolio_income_event DROP CONSTRAINT portfolio_income_event_income_type_check;
DELETE FROM portfolio_income_event WHERE tax_treatment IS NULL OR tax_treatment NOT IN ('exempt', 'exclusive') OR income_type NOT IN ('dividend', 'jcp', 'interest', 'coupon');
ALTER TABLE portfolio_income_event ALTER COLUMN tax_treatment SET NOT NULL;
ALTER TABLE portfolio_income_event ADD CONSTRAINT portfolio_income_event_income_type_check CHECK (income_type IN ('dividend', 'jcp', 'interest', 'coupon'));
ALTER TABLE portfolio_income_event ADD CONSTRAINT portfolio_income_event_tax_treatment_check CHECK (tax_treatment IN ('exempt', 'exclusive'));

ALTER TABLE ledger_investment_income DROP CONSTRAINT ledger_investment_income_income_type_check;
DELETE FROM ledger_investment_income WHERE income_type NOT IN ('dividend', 'jcp', 'interest', 'coupon');
ALTER TABLE ledger_investment_income ADD CONSTRAINT ledger_investment_income_income_type_check CHECK (income_type IN ('dividend', 'jcp', 'interest', 'coupon'));

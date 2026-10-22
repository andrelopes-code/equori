-- +goose Up
ALTER TABLE ledger_billing_cycle_rule
    ALTER COLUMN calendar DROP DEFAULT,
    ADD CONSTRAINT ledger_billing_cycle_rule_calendar_check CHECK (calendar ~ '^[a-z0-9_]{2,40}$');

-- +goose Down
ALTER TABLE ledger_billing_cycle_rule
    DROP CONSTRAINT ledger_billing_cycle_rule_calendar_check,
    ALTER COLUMN calendar SET DEFAULT 'br_banking';

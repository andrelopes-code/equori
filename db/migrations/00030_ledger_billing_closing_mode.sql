-- +goose Up
-- A87: a card may close a number of days before its nominal due date, and its closing date,
-- projected or reported, may be shifted by the calendar.
ALTER TABLE ledger_billing_cycle_rule ALTER COLUMN closing_day DROP NOT NULL;
ALTER TABLE ledger_billing_cycle_rule
    ADD COLUMN closing_mode text NOT NULL DEFAULT 'day' CHECK (closing_mode IN ('day', 'before_due')),
    ADD COLUMN closing_days_before_due smallint CHECK (closing_days_before_due BETWEEN 1 AND 28),
    ADD COLUMN closing_adjustment text NOT NULL DEFAULT 'none'
        CHECK (closing_adjustment IN ('none', 'following', 'preceding', 'modified_following')),
    ADD CONSTRAINT ledger_billing_cycle_rule_closing_check CHECK (
        (closing_mode = 'day' AND closing_day IS NOT NULL AND closing_days_before_due IS NULL) OR
        (closing_mode = 'before_due' AND closing_day IS NULL AND closing_days_before_due IS NOT NULL));

-- +goose Down
DELETE FROM ledger_billing_cycle_rule WHERE closing_mode = 'before_due';
ALTER TABLE ledger_billing_cycle_rule
    DROP CONSTRAINT ledger_billing_cycle_rule_closing_check,
    DROP COLUMN closing_adjustment, DROP COLUMN closing_days_before_due, DROP COLUMN closing_mode;
ALTER TABLE ledger_billing_cycle_rule ALTER COLUMN closing_day SET NOT NULL;

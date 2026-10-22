-- +goose Up
-- A117: a reimbursement_of link holds the part of the expense that the incoming transaction repays.
ALTER TABLE ledger_link
    ADD COLUMN amount bigint,
    ADD CONSTRAINT ledger_link_amount_check CHECK (amount IS NULL OR (amount > 0 AND link_type = 'reimbursement_of'));

-- +goose Down
ALTER TABLE ledger_link DROP CONSTRAINT ledger_link_amount_check, DROP COLUMN amount;

-- +goose Up
-- P7 final review: a terms version records the sequence of its first date when kept
-- occurrences already hold the sequences it would continue with (A49), and an occurrence
-- records the transaction the owner released from it, which no longer realizes it (A51).
ALTER TABLE planning_schedule_terms ADD COLUMN first_sequence int CHECK (first_sequence >= 1);
ALTER TABLE planning_occurrence ADD COLUMN declined_transaction_id uuid,
    ADD FOREIGN KEY (user_id, declined_transaction_id) REFERENCES ledger_transaction (user_id, id);

-- +goose Down
ALTER TABLE planning_occurrence DROP COLUMN declined_transaction_id;
ALTER TABLE planning_schedule_terms DROP COLUMN first_sequence;

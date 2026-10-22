-- +goose Up
ALTER TABLE ledger_tag DROP CONSTRAINT ledger_tag_name_check;
ALTER TABLE ledger_tag ADD CONSTRAINT ledger_tag_name_check
    CHECK (length(name) BETWEEN 1 AND 60 AND name !~ '\s' AND name !~ '^-');

-- +goose Down
ALTER TABLE ledger_tag DROP CONSTRAINT ledger_tag_name_check;
ALTER TABLE ledger_tag ADD CONSTRAINT ledger_tag_name_check
    CHECK (name ~ '^[a-z0-9][a-z0-9-]{0,59}$');

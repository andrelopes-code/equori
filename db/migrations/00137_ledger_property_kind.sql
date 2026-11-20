-- +goose Up
-- Property account design PA1 (A259): kind property, class asset only.
ALTER TABLE ledger_account DROP CONSTRAINT ledger_account_kind_check;
ALTER TABLE ledger_account ADD CONSTRAINT ledger_account_kind_check CHECK (kind IN (
    'checking', 'savings', 'cash', 'wallet', 'benefit', 'reserve', 'brokerage', 'receivable',
    'property', 'credit_card', 'loan', 'payable'
));
ALTER TABLE ledger_account DROP CONSTRAINT ledger_account_check2;
ALTER TABLE ledger_account ADD CONSTRAINT ledger_account_check2 CHECK (
    kind IS NULL OR
    (account_class = 'asset' AND kind IN (
        'checking', 'savings', 'cash', 'wallet', 'benefit', 'reserve', 'brokerage', 'receivable',
        'property', 'loan'
    )) OR
    (account_class = 'liability' AND kind IN ('credit_card', 'loan', 'payable'))
);

-- +goose Down
-- A book with a property account stops the rollback: the constraint rejects its row.
ALTER TABLE ledger_account DROP CONSTRAINT ledger_account_check2;
ALTER TABLE ledger_account ADD CONSTRAINT ledger_account_check2 CHECK (
    kind IS NULL OR
    (account_class = 'asset' AND kind IN (
        'checking', 'savings', 'cash', 'wallet', 'benefit', 'reserve', 'brokerage', 'receivable',
        'loan'
    )) OR
    (account_class = 'liability' AND kind IN ('credit_card', 'loan', 'payable'))
);
ALTER TABLE ledger_account DROP CONSTRAINT ledger_account_kind_check;
ALTER TABLE ledger_account ADD CONSTRAINT ledger_account_kind_check CHECK (kind IN (
    'checking', 'savings', 'cash', 'wallet', 'benefit', 'reserve', 'brokerage', 'receivable',
    'credit_card', 'loan', 'payable'
));

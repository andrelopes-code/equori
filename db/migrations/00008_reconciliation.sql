-- +goose Up
CREATE TABLE ledger_balance_assertion (
    id          uuid   NOT NULL DEFAULT uuidv7(),
    user_id     bigint NOT NULL,
    account_id  uuid   NOT NULL,
    date        date   NOT NULL,
    amount      bigint NOT NULL CHECK (abs(amount) <= 9007199254740991),
    source      text   NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'open_finance')),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE
);
CREATE INDEX ledger_balance_assertion_account_idx ON ledger_balance_assertion (account_id, date);

CREATE TABLE ledger_reconciliation (
    id                        uuid   NOT NULL DEFAULT uuidv7(),
    user_id                   bigint NOT NULL,
    account_id                uuid   NOT NULL,
    date                      date   NOT NULL,
    assertion_id              uuid   UNIQUE,
    statement_id              uuid   UNIQUE,
    difference                bigint NOT NULL,
    resolution                text   NOT NULL CHECK (resolution IN ('none', 'yield', 'adjustment', 'transactions_added')),
    resolution_transaction_id uuid,
    reconciled_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, assertion_id) REFERENCES ledger_balance_assertion (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, statement_id) REFERENCES ledger_statement (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, resolution_transaction_id) REFERENCES ledger_transaction (user_id, id),
    CHECK ((assertion_id IS NULL) <> (statement_id IS NULL))
);
CREATE INDEX ledger_reconciliation_account_idx ON ledger_reconciliation (account_id, date DESC);

CREATE TABLE ledger_attachment_blob (
    user_id bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    sha256  bytea  NOT NULL,
    size    int    NOT NULL CHECK (size BETWEEN 1 AND 10485760),
    content bytea  NOT NULL,
    PRIMARY KEY (user_id, sha256)
);

CREATE TABLE ledger_attachment (
    id             uuid   NOT NULL DEFAULT uuidv7(),
    user_id        bigint NOT NULL,
    transaction_id uuid   NOT NULL,
    sha256         bytea  NOT NULL,
    file_name      text   NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
    media_type     text   NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (transaction_id, sha256),
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, sha256) REFERENCES ledger_attachment_blob (user_id, sha256)
);

-- +goose Down
DROP TABLE ledger_attachment, ledger_attachment_blob, ledger_reconciliation, ledger_balance_assertion;

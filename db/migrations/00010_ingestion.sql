-- +goose Up
-- P4 amendment A13: how CSV files of one account are read.
CREATE TABLE ingestion_csv_profile (
    user_id            bigint NOT NULL,
    account_id         uuid   NOT NULL,
    delimiter          text   NOT NULL DEFAULT ',' CHECK (length(delimiter) = 1),
    header_rows        int    NOT NULL DEFAULT 1 CHECK (header_rows BETWEEN 0 AND 10),
    date_column        text   NOT NULL,
    date_layout        text   NOT NULL CHECK (date_layout IN ('DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY')),
    amount_column      text,
    debit_column       text,
    credit_column      text,
    decimal_separator  text   NOT NULL CHECK (decimal_separator IN (',', '.')),
    description_column text   NOT NULL,
    id_column          text,
    amount_sign        text   NOT NULL DEFAULT 'as_is' CHECK (amount_sign IN ('as_is', 'inverted')),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE,
    CHECK ((debit_column IS NULL) = (credit_column IS NULL)),
    CHECK ((amount_column IS NULL) <> (debit_column IS NULL))
);

CREATE TABLE ingestion_batch (
    id               uuid   NOT NULL DEFAULT uuidv7(),
    user_id          bigint NOT NULL,
    account_id       uuid   NOT NULL,
    source           text   NOT NULL CHECK (source IN ('ofx', 'csv')),
    file_name        text   NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
    currency         text   NOT NULL,
    period_from      date,
    period_to        date,
    received         int    NOT NULL DEFAULT 0,
    ignored          int    NOT NULL DEFAULT 0,
    matched          int    NOT NULL DEFAULT 0,
    created          int    NOT NULL DEFAULT 0,
    needs_review     int    NOT NULL DEFAULT 0,
    discarded        int    NOT NULL DEFAULT 0,
    balance_date     date,
    balance_amount   bigint,
    balance_status   text   NOT NULL DEFAULT 'none' CHECK (balance_status IN ('none', 'recorded', 'skipped')),
    balance_reason   text,
    started_at       timestamptz NOT NULL DEFAULT now(),
    completed_at     timestamptz,
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE,
    CHECK ((balance_date IS NULL) = (balance_amount IS NULL)),
    CHECK (period_from <= period_to)
);
CREATE INDEX ingestion_batch_user_idx ON ingestion_batch (user_id, started_at DESC, id DESC);

-- A duplicate of a finished record is counted as ignored by its batch, never stored (I10).
CREATE TABLE ingestion_external_record (
    id             uuid   NOT NULL DEFAULT uuidv7(),
    user_id        bigint NOT NULL,
    batch_id       uuid   NOT NULL,
    account_id     uuid   NOT NULL,
    external_id    text,
    dedup_key      bytea  NOT NULL CHECK (length(dedup_key) = 32),
    raw            jsonb  NOT NULL,
    booked_on      date   NOT NULL,
    amount         bigint NOT NULL,
    description    text   NOT NULL,
    state          text   NOT NULL DEFAULT 'received' CHECK (state IN ('received', 'matched', 'created', 'needs_review', 'discarded')),
    transaction_id uuid,
    candidates     uuid[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    UNIQUE (user_id, dedup_key),
    FOREIGN KEY (user_id, batch_id) REFERENCES ingestion_batch (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id),
    CHECK ((state IN ('matched', 'created')) = (transaction_id IS NOT NULL))
);
CREATE UNIQUE INDEX ingestion_record_transaction_idx ON ingestion_external_record (user_id, transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX ingestion_record_batch_idx ON ingestion_external_record (batch_id, id);

-- +goose Down
DROP TABLE ingestion_external_record, ingestion_batch, ingestion_csv_profile;

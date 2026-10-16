-- +goose Up
-- P6 amendment A34: one aggregator application per row; a user may hold several.
-- credential_ciphertext is sealed under EQUORI_SECRET_KEY (ADR 008).
CREATE TABLE ingestion_integration (
    id                    uuid   NOT NULL,
    user_id               bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    provider              text   NOT NULL CHECK (provider IN ('pluggy')),
    name                  text   NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    credential_ciphertext bytea  NOT NULL,
    updated_at            timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    CONSTRAINT ingestion_integration_name_key UNIQUE (user_id, name)
);

CREATE TABLE ingestion_connection (
    id                  uuid   NOT NULL DEFAULT uuidv7(),
    user_id             bigint NOT NULL,
    integration_id      uuid   NOT NULL,
    external_item_id    text   NOT NULL CHECK (length(external_item_id) BETWEEN 1 AND 100),
    name                text   NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    provider_status     text   NOT NULL,
    last_item_update_at timestamptz,
    last_synced_at      timestamptz,
    last_error          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    CONSTRAINT ingestion_connection_item_key UNIQUE (user_id, integration_id, external_item_id),
    CONSTRAINT ingestion_connection_integration_fkey FOREIGN KEY (user_id, integration_id)
        REFERENCES ingestion_integration (user_id, id) ON DELETE RESTRICT
);
CREATE INDEX ingestion_connection_list_idx ON ingestion_connection (user_id, name, id);

-- A35: an external account is pending, mapped to one leaf balance account, or ignored.
-- One ledger account takes one feed, so two balance assertions never compete for it.
CREATE TABLE ingestion_external_account (
    id                  uuid   NOT NULL DEFAULT uuidv7(),
    user_id             bigint NOT NULL,
    connection_id       uuid   NOT NULL,
    external_account_id text   NOT NULL,
    type                text   NOT NULL,
    subtype             text   NOT NULL,
    name                text   NOT NULL,
    number_last4        text   CHECK (number_last4 ~ '^[0-9]{1,4}$'),
    currency            text   NOT NULL,
    account_id          uuid,
    sync_from           date,
    ignored             boolean NOT NULL DEFAULT false,
    last_synced_on      date,
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    UNIQUE (connection_id, external_account_id),
    CONSTRAINT ingestion_external_account_feed_key UNIQUE (user_id, account_id),
    FOREIGN KEY (user_id, connection_id) REFERENCES ingestion_connection (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE SET NULL (account_id),
    CHECK (account_id IS NULL OR sync_from IS NOT NULL),
    CHECK (NOT (ignored AND account_id IS NOT NULL))
);

-- A36: a sync of one mapped account is a batch without a file.
ALTER TABLE ingestion_batch
    DROP CONSTRAINT ingestion_batch_source_check,
    ADD CONSTRAINT ingestion_batch_source_check CHECK (source IN ('ofx', 'csv', 'open_finance')),
    ALTER COLUMN file_name DROP NOT NULL,
    ADD CONSTRAINT ingestion_batch_file_check CHECK ((source = 'open_finance') = (file_name IS NULL)),
    ADD COLUMN external_account_id uuid,
    ADD CONSTRAINT ingestion_batch_external_account_check CHECK (external_account_id IS NULL OR source = 'open_finance'),
    ADD FOREIGN KEY (user_id, external_account_id) REFERENCES ingestion_external_account (user_id, id) ON DELETE SET NULL (external_account_id);

-- +goose Down
ALTER TABLE ingestion_batch
    DROP COLUMN external_account_id,
    DROP CONSTRAINT ingestion_batch_file_check,
    ALTER COLUMN file_name SET NOT NULL,
    DROP CONSTRAINT ingestion_batch_source_check,
    ADD CONSTRAINT ingestion_batch_source_check CHECK (source IN ('ofx', 'csv'));
DROP TABLE ingestion_external_account, ingestion_connection, ingestion_integration;

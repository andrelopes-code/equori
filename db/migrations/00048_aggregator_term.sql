-- +goose Up
ALTER TABLE ingestion_integration RENAME COLUMN provider TO aggregator;
ALTER TABLE ingestion_integration DROP CONSTRAINT ingestion_integration_provider_check;
ALTER TABLE ingestion_integration ADD CONSTRAINT ingestion_integration_aggregator_check CHECK (aggregator ~ '^[a-z0-9_]{2,40}$');

ALTER TABLE classification_source_category RENAME COLUMN provider TO aggregator;
ALTER TABLE classification_source_category DROP CONSTRAINT classification_source_category_provider_check;
ALTER TABLE classification_source_category ADD CONSTRAINT classification_source_category_aggregator_check CHECK (aggregator ~ '^[a-z0-9_]{2,40}$');

ALTER TABLE ingestion_batch
    DROP CONSTRAINT ingestion_batch_source_check,
    DROP CONSTRAINT ingestion_batch_file_check,
    DROP CONSTRAINT ingestion_batch_external_account_check;
UPDATE ingestion_batch SET source = 'aggregator' WHERE source = 'open_finance';
ALTER TABLE ingestion_batch
    ADD CONSTRAINT ingestion_batch_source_check CHECK (source IN ('ofx', 'csv', 'aggregator')),
    ADD CONSTRAINT ingestion_batch_file_check CHECK ((source = 'aggregator') = (file_name IS NULL)),
    ADD CONSTRAINT ingestion_batch_external_account_check CHECK (external_account_id IS NULL OR source = 'aggregator');

ALTER TABLE ledger_balance_assertion DROP CONSTRAINT ledger_balance_assertion_source_check;
UPDATE ledger_balance_assertion SET source = 'aggregator' WHERE source = 'open_finance';
ALTER TABLE ledger_balance_assertion ADD CONSTRAINT ledger_balance_assertion_source_check CHECK (source IN ('manual', 'import', 'aggregator'));

-- +goose Down
ALTER TABLE ledger_balance_assertion DROP CONSTRAINT ledger_balance_assertion_source_check;
UPDATE ledger_balance_assertion SET source = 'open_finance' WHERE source = 'aggregator';
ALTER TABLE ledger_balance_assertion ADD CONSTRAINT ledger_balance_assertion_source_check CHECK (source IN ('manual', 'import', 'open_finance'));

ALTER TABLE ingestion_batch
    DROP CONSTRAINT ingestion_batch_source_check,
    DROP CONSTRAINT ingestion_batch_file_check,
    DROP CONSTRAINT ingestion_batch_external_account_check;
UPDATE ingestion_batch SET source = 'open_finance' WHERE source = 'aggregator';
ALTER TABLE ingestion_batch
    ADD CONSTRAINT ingestion_batch_source_check CHECK (source IN ('ofx', 'csv', 'open_finance')),
    ADD CONSTRAINT ingestion_batch_file_check CHECK ((source = 'open_finance') = (file_name IS NULL)),
    ADD CONSTRAINT ingestion_batch_external_account_check CHECK (external_account_id IS NULL OR source = 'open_finance');

ALTER TABLE classification_source_category DROP CONSTRAINT classification_source_category_aggregator_check;
ALTER TABLE classification_source_category RENAME COLUMN aggregator TO provider;
ALTER TABLE classification_source_category ADD CONSTRAINT classification_source_category_provider_check CHECK (provider IN ('pluggy'));

ALTER TABLE ingestion_integration DROP CONSTRAINT ingestion_integration_aggregator_check;
ALTER TABLE ingestion_integration RENAME COLUMN aggregator TO provider;
ALTER TABLE ingestion_integration ADD CONSTRAINT ingestion_integration_provider_check CHECK (provider IN ('pluggy'));

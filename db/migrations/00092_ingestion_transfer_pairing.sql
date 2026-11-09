-- +goose Up
-- A221: the SHA-256 digest of the holder of an external account, and the counterparty of a
-- sync line as A217 rule 4 classifies it. No document is stored.
ALTER TABLE ingestion_external_account
    ADD COLUMN holder_digest bytea CHECK (octet_length(holder_digest) = 32);

ALTER TABLE ingestion_external_record
    ADD COLUMN counterparty text CHECK (counterparty IN ('holder', 'third_party'));

-- A219, A220: review transfer and decision paired.
ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group', 'reserve', 'duplicate', 'transfer')),
    DROP CONSTRAINT ingestion_external_record_decision_check,
    ADD CONSTRAINT ingestion_external_record_decision_check
    CHECK (decision IN ('linked', 'followed', 'withdrawn', 're_identified', 'paired'));

-- A220 rule 5: the records of a batch that a sync paired.
ALTER TABLE ingestion_batch
    ADD COLUMN paired integer NOT NULL DEFAULT 0;

-- +goose Down
UPDATE ingestion_external_record
SET review_reason = 'ambiguous'
WHERE review_reason = 'transfer';

UPDATE ingestion_external_record
SET decision = NULL,
    decision_undo = '{}'
WHERE decision = 'paired';

UPDATE ingestion_batch
SET matched = matched + paired;

ALTER TABLE ingestion_batch
    DROP COLUMN paired;

ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_decision_check,
    ADD CONSTRAINT ingestion_external_record_decision_check
    CHECK (decision IN ('linked', 'followed', 'withdrawn', 're_identified')),
    DROP CONSTRAINT ingestion_external_record_review_reason_check,
    ADD CONSTRAINT ingestion_external_record_review_reason_check
    CHECK (review_reason IN ('ambiguous', 'probable', 'changed', 'repeated', 'group', 'reserve', 'duplicate')),
    DROP COLUMN counterparty;

ALTER TABLE ingestion_external_account
    DROP COLUMN holder_digest;

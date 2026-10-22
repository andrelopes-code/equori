-- +goose Up
-- Regional neutrality spec 5.7: an institution identifier carries its scheme; the ISPB becomes the br_ispb scheme.
ALTER TABLE ledger_institution
    ADD COLUMN identifier_scheme text CHECK (identifier_scheme ~ '^[a-z0-9_]{2,40}$'),
    ADD COLUMN identifier text CHECK (length(identifier) BETWEEN 1 AND 40),
    ADD CONSTRAINT ledger_institution_identifier_pair CHECK ((identifier_scheme IS NULL) = (identifier IS NULL));
UPDATE ledger_institution SET identifier_scheme = 'br_ispb', identifier = ispb WHERE ispb IS NOT NULL;
DROP INDEX ledger_institution_ispb_key;
ALTER TABLE ledger_institution DROP COLUMN ispb;
CREATE UNIQUE INDEX ledger_institution_identifier_key ON ledger_institution (user_id, identifier_scheme, identifier);

-- +goose Down
DROP INDEX ledger_institution_identifier_key;
ALTER TABLE ledger_institution ADD COLUMN ispb text CHECK (ispb ~ '^[0-9]{8}$');
UPDATE ledger_institution SET ispb = identifier WHERE identifier_scheme = 'br_ispb';
ALTER TABLE ledger_institution DROP CONSTRAINT ledger_institution_identifier_pair, DROP COLUMN identifier_scheme, DROP COLUMN identifier;
CREATE UNIQUE INDEX ledger_institution_ispb_key ON ledger_institution (user_id, ispb);

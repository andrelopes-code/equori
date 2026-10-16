-- +goose Up
-- P6 amendments A36, A38, A40, A41: what an aggregator says about a line, kept to detect
-- its later changes. withdrawn: the aggregator stopped returning the line (A38).
ALTER TABLE ingestion_external_record
    ADD COLUMN external_status    text CHECK (external_status IN ('PENDING', 'POSTED')),
    ADD COLUMN due_date           date,
    ADD COLUMN installment_number int,
    ADD COLUMN installment_count  int,
    ADD COLUMN category_id        text,
    ADD COLUMN balance_after      bigint,
    -- A provider change the ledger did not take: the posting was reconciled, or the amount changed.
    ADD COLUMN unapplied_change   text,
    DROP CONSTRAINT ingestion_external_record_state_check,
    ADD CONSTRAINT ingestion_external_record_state_check
        CHECK (state IN ('received', 'matched', 'created', 'needs_review', 'discarded', 'withdrawn')),
    ADD CONSTRAINT ingestion_external_record_installment_check
        CHECK ((installment_number IS NULL) = (installment_count IS NULL) AND installment_number BETWEEN 1 AND installment_count);

ALTER TABLE ingestion_batch
    ADD COLUMN updated   int NOT NULL DEFAULT 0,
    ADD COLUMN withdrawn int NOT NULL DEFAULT 0;

-- A42: the last balance asserted from the feed, so a repeated sync asserts nothing new.
ALTER TABLE ingestion_external_account
    ADD COLUMN balance_on     date,
    ADD COLUMN balance_amount bigint,
    ADD CONSTRAINT ingestion_external_account_balance_check CHECK ((balance_on IS NULL) = (balance_amount IS NULL));

-- I05: a reconciled posting changes only its link to an external record, so a withdrawn
-- line releases it and the line's new id takes it again (A38), and its void flag.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION ledger_protect_reconciled() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    kept ledger_posting;
BEGIN
    IF OLD.status <> 'reconciled' OR current_setting('equori.unlock_reconciled', true) = 'on' THEN
        RETURN coalesce(NEW, OLD);
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.voided OR NOT OLD.voided) THEN
        kept := NEW;
        kept.external_record_id := OLD.external_record_id;
        kept.voided := OLD.voided;
        IF kept IS NOT DISTINCT FROM OLD THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'posting % is reconciled and cannot change', OLD.id USING ERRCODE = 'check_violation';
END;
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION ledger_protect_reconciled() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status <> 'reconciled' OR current_setting('equori.unlock_reconciled', true) = 'on' THEN
        RETURN coalesce(NEW, OLD);
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.voided AND NOT OLD.voided
       AND (NEW.amount, NEW.weight, NEW.account_id, NEW.status, NEW.booked_on, NEW.settled_on, NEW.statement_id)
           IS NOT DISTINCT FROM (OLD.amount, OLD.weight, OLD.account_id, OLD.status, OLD.booked_on, OLD.settled_on, OLD.statement_id) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'posting % is reconciled and cannot change', OLD.id USING ERRCODE = 'check_violation';
END;
$$;
-- +goose StatementEnd
ALTER TABLE ingestion_external_account DROP COLUMN balance_on, DROP COLUMN balance_amount;
ALTER TABLE ingestion_batch DROP COLUMN updated, DROP COLUMN withdrawn;
ALTER TABLE ingestion_external_record
    DROP CONSTRAINT ingestion_external_record_installment_check,
    DROP CONSTRAINT ingestion_external_record_state_check,
    ADD CONSTRAINT ingestion_external_record_state_check
        CHECK (state IN ('received', 'matched', 'created', 'needs_review', 'discarded')),
    DROP COLUMN external_status, DROP COLUMN due_date, DROP COLUMN installment_number,
    DROP COLUMN installment_count, DROP COLUMN category_id, DROP COLUMN balance_after,
    DROP COLUMN unapplied_change;

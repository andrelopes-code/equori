-- +goose Up
CREATE TABLE ledger_billing_cycle_rule (
    user_id                bigint NOT NULL,
    account_id             uuid   NOT NULL,
    effective_from         date   NOT NULL CHECK (extract(day FROM effective_from) = 1),
    closing_day            smallint NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
    due_day                smallint NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    closing_day_assignment text   NOT NULL DEFAULT 'next' CHECK (closing_day_assignment IN ('next', 'closing')),
    due_date_adjustment    text   NOT NULL DEFAULT 'following' CHECK (due_date_adjustment IN ('none', 'following', 'preceding', 'modified_following')),
    calendar               text   NOT NULL DEFAULT 'br_banking',
    created_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, effective_from),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE
);

CREATE TABLE ledger_credit_limit (
    user_id        bigint NOT NULL,
    account_id     uuid   NOT NULL,
    effective_from date   NOT NULL,
    amount         bigint NOT NULL CHECK (amount > 0 AND amount <= 9007199254740991),
    created_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, effective_from),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE
);

CREATE TABLE ledger_card (
    id         uuid   NOT NULL DEFAULT uuidv7(),
    user_id    bigint NOT NULL,
    account_id uuid   NOT NULL,
    holder     text   NOT NULL CHECK (length(holder) BETWEEN 1 AND 120),
    last_four  text   NOT NULL CHECK (last_four ~ '^[0-9]{4}$'),
    virtual    boolean NOT NULL DEFAULT false,
    active     boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE
);

CREATE TABLE ledger_statement (
    id                  uuid   NOT NULL DEFAULT uuidv7(),
    user_id             bigint NOT NULL,
    account_id          uuid   NOT NULL,
    reference_month     date   NOT NULL CHECK (extract(day FROM reference_month) = 1),
    closing_date        date   NOT NULL,
    due_date            date   NOT NULL,
    financed_by_plan_id uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    UNIQUE (account_id, reference_month),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE,
    CHECK (due_date > closing_date)
);

CREATE TABLE ledger_installment_plan (
    id                    uuid     NOT NULL DEFAULT uuidv7(),
    user_id               bigint   NOT NULL,
    account_id            uuid     NOT NULL,
    origin_transaction_id uuid     NOT NULL,
    plan_kind             text     NOT NULL CHECK (plan_kind IN ('purchase', 'financing')),
    installment_count     smallint NOT NULL CHECK (installment_count BETWEEN 2 AND 420),
    principal             bigint   NOT NULL CHECK (principal > 0),
    interest              bigint   NOT NULL DEFAULT 0 CHECK (interest >= 0),
    monthly_rate          numeric(30, 12),
    first_statement_id    uuid     NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, origin_transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, first_statement_id) REFERENCES ledger_statement (user_id, id)
);

ALTER TABLE ledger_statement
    ADD FOREIGN KEY (user_id, financed_by_plan_id) REFERENCES ledger_installment_plan (user_id, id);

ALTER TABLE ledger_posting
    ADD COLUMN statement_id        uuid,
    ADD COLUMN card_role           text CHECK (card_role IN ('charge', 'credit', 'payment')),
    ADD COLUMN installment_plan_id uuid,
    ADD COLUMN installment_number  smallint,
    ADD COLUMN installment_count   smallint,
    ADD FOREIGN KEY (user_id, statement_id) REFERENCES ledger_statement (user_id, id),
    ADD FOREIGN KEY (user_id, installment_plan_id) REFERENCES ledger_installment_plan (user_id, id),
    ADD CHECK ((statement_id IS NULL) = (card_role IS NULL)),
    ADD CHECK ((installment_plan_id IS NULL) = (installment_number IS NULL)
               AND (installment_number IS NULL) = (installment_count IS NULL)),
    ADD CHECK (installment_number IS NULL OR installment_number BETWEEN 1 AND installment_count);

CREATE INDEX ledger_posting_statement_idx ON ledger_posting (statement_id) INCLUDE (amount, card_role) WHERE NOT voided;
CREATE INDEX ledger_posting_plan_idx ON ledger_posting (installment_plan_id, installment_number);

CREATE TABLE ledger_dispute (
    id                    uuid   NOT NULL DEFAULT uuidv7(),
    user_id               bigint NOT NULL,
    transaction_id        uuid   NOT NULL,
    opened_on             date   NOT NULL,
    resolved_on           date,
    outcome               text   CHECK (outcome IN ('won', 'lost')),
    refund_transaction_id uuid,
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, refund_transaction_id) REFERENCES ledger_transaction (user_id, id),
    CHECK ((resolved_on IS NULL) = (outcome IS NULL)),
    CHECK (resolved_on IS NULL OR resolved_on >= opened_on)
);
CREATE UNIQUE INDEX ledger_dispute_open_key ON ledger_dispute (transaction_id) WHERE resolved_on IS NULL;

-- I03, I04: card postings belong to a statement of their own account; other postings to none.
-- +goose StatementBegin
CREATE FUNCTION ledger_check_card_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    account_kind text;
    statement_account uuid;
BEGIN
    SELECT kind INTO account_kind FROM ledger_account WHERE id = NEW.account_id;
    IF account_kind = 'credit_card' AND NEW.statement_id IS NULL THEN
        RAISE EXCEPTION 'card posting on account % needs a statement', NEW.account_id USING ERRCODE = 'check_violation';
    END IF;
    IF account_kind IS DISTINCT FROM 'credit_card' AND NEW.statement_id IS NOT NULL THEN
        RAISE EXCEPTION 'only card postings belong to a statement' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.statement_id IS NOT NULL THEN
        SELECT account_id INTO statement_account FROM ledger_statement WHERE id = NEW.statement_id;
        IF statement_account <> NEW.account_id THEN
            RAISE EXCEPTION 'statement % belongs to another card', NEW.statement_id USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER ledger_posting_card
    BEFORE INSERT OR UPDATE OF account_id, statement_id ON ledger_posting
    FOR EACH ROW EXECUTE FUNCTION ledger_check_card_posting();

-- I05 (P2 amendment A3): reconciled postings are never edited or deleted. The void
-- copy may change, and an explicit unlock (P3) sets equori.unlock_reconciled.
-- +goose StatementBegin
CREATE FUNCTION ledger_protect_reconciled() RETURNS trigger LANGUAGE plpgsql AS $$
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
CREATE TRIGGER ledger_posting_reconciled
    BEFORE UPDATE OR DELETE ON ledger_posting
    FOR EACH ROW EXECUTE FUNCTION ledger_protect_reconciled();

-- +goose Down
DROP TRIGGER ledger_posting_reconciled ON ledger_posting;
DROP TRIGGER ledger_posting_card ON ledger_posting;
DROP FUNCTION ledger_protect_reconciled, ledger_check_card_posting;
DROP TABLE ledger_dispute;
ALTER TABLE ledger_posting
    DROP COLUMN statement_id, DROP COLUMN card_role, DROP COLUMN installment_plan_id,
    DROP COLUMN installment_number, DROP COLUMN installment_count;
ALTER TABLE ledger_statement DROP CONSTRAINT ledger_statement_user_id_financed_by_plan_id_fkey;
DROP TABLE ledger_installment_plan, ledger_statement, ledger_card, ledger_credit_limit, ledger_billing_cycle_rule;

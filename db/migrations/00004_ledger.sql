-- +goose Up
CREATE TABLE ledger_settings (
    user_id       bigint PRIMARY KEY REFERENCES identity_user (id) ON DELETE CASCADE,
    base_currency text   NOT NULL REFERENCES marketdata_instrument (code)
);

CREATE TABLE ledger_institution (
    id      uuid   NOT NULL DEFAULT uuidv7(),
    user_id bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name    text   NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    code    text,
    PRIMARY KEY (id),
    UNIQUE (user_id, id)
);
CREATE UNIQUE INDEX ledger_institution_name_key ON ledger_institution (user_id, lower(name));

CREATE TABLE ledger_payee (
    id      uuid   NOT NULL DEFAULT uuidv7(),
    user_id bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name    text   NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    PRIMARY KEY (id),
    UNIQUE (user_id, id)
);
CREATE UNIQUE INDEX ledger_payee_name_key ON ledger_payee (user_id, lower(name));

CREATE TABLE ledger_account (
    id                    uuid   NOT NULL DEFAULT uuidv7(),
    user_id               bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name                  text   NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    account_class         text   NOT NULL CHECK (account_class IN ('asset', 'liability', 'equity', 'income', 'expense')),
    kind                  text   CHECK (kind IN ('checking', 'savings', 'cash', 'wallet', 'benefit', 'reserve', 'brokerage', 'receivable', 'credit_card', 'loan', 'payable')),
    instrument            text   NOT NULL REFERENCES marketdata_instrument (code),
    parent_id             uuid,
    institution_id        uuid,
    counterparty_payee_id uuid,
    opened_on             date   NOT NULL,
    closed_on             date,
    yield_mode            text   NOT NULL DEFAULT 'none' CHECK (yield_mode IN ('none', 'auto')),
    system_role           text   CHECK (system_role IN ('opening_balances', 'adjustments', 'uncategorized_expense', 'uncategorized_income', 'yield', 'discounts', 'interest', 'taxes', 'fees', 'realized_gains', 'realized_losses')),
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, parent_id) REFERENCES ledger_account (user_id, id),
    FOREIGN KEY (user_id, institution_id) REFERENCES ledger_institution (user_id, id),
    FOREIGN KEY (user_id, counterparty_payee_id) REFERENCES ledger_payee (user_id, id),
    CHECK (closed_on IS NULL OR closed_on >= opened_on),
    CHECK (
        (account_class IN ('asset', 'liability') AND kind IS NOT NULL) OR
        (account_class IN ('equity', 'income', 'expense') AND kind IS NULL)
    ),
    CHECK (
        kind IS NULL OR
        (account_class = 'asset' AND kind IN ('checking', 'savings', 'cash', 'wallet', 'benefit', 'reserve', 'brokerage', 'receivable', 'loan')) OR
        (account_class = 'liability' AND kind IN ('credit_card', 'loan', 'payable'))
    )
);
CREATE UNIQUE INDEX ledger_account_system_role_key ON ledger_account (user_id, system_role) WHERE system_role IS NOT NULL;

CREATE TABLE ledger_tag (
    id      uuid   NOT NULL DEFAULT uuidv7(),
    user_id bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name    text   NOT NULL CHECK (name ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    UNIQUE (user_id, name)
);

CREATE TABLE ledger_transaction (
    id                 uuid   NOT NULL DEFAULT uuidv7(),
    user_id            bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    date               date   NOT NULL,
    description        text   NOT NULL CHECK (length(description) <= 500),
    payee_id           uuid,
    balancing_currency text   NOT NULL REFERENCES marketdata_instrument (code),
    origin             text   NOT NULL CHECK (origin IN ('manual', 'import', 'schedule', 'system')),
    version            int    NOT NULL DEFAULT 1 CHECK (version >= 1),
    voided_at          timestamptz,
    void_reason        text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, payee_id) REFERENCES ledger_payee (user_id, id)
);
CREATE INDEX ledger_transaction_list_idx ON ledger_transaction (user_id, date DESC, id DESC);
CREATE INDEX ledger_transaction_payee_idx ON ledger_transaction (user_id, payee_id, date);

CREATE TABLE ledger_transaction_version (
    transaction_id uuid        NOT NULL REFERENCES ledger_transaction (id) ON DELETE CASCADE,
    version        int         NOT NULL,
    snapshot       jsonb       NOT NULL,
    reason         text        NOT NULL,
    replaced_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (transaction_id, version)
);

CREATE TABLE ledger_transaction_tag (
    user_id        bigint NOT NULL,
    transaction_id uuid   NOT NULL,
    tag_id         uuid   NOT NULL,
    PRIMARY KEY (transaction_id, tag_id),
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, tag_id) REFERENCES ledger_tag (user_id, id) ON DELETE CASCADE
);

CREATE TABLE ledger_posting (
    id                  uuid     NOT NULL DEFAULT uuidv7(),
    user_id             bigint   NOT NULL,
    transaction_id      uuid     NOT NULL,
    account_id          uuid     NOT NULL,
    position            smallint NOT NULL CHECK (position >= 0),
    amount              bigint   NOT NULL CHECK (amount <> 0 AND abs(amount) <= 9007199254740991),
    weight              bigint   NOT NULL CHECK (weight <> 0 AND abs(weight) <= 9007199254740991),
    booked_on           date     NOT NULL,
    settled_on          date,
    status              text     NOT NULL CHECK (status IN ('pending', 'cleared', 'reconciled')),
    original_amount     bigint,
    original_instrument text REFERENCES marketdata_instrument (code),
    memo                text CHECK (length(memo) <= 500),
    -- Copy of the transaction's void state, so balance sums read only this table's index.
    voided              boolean  NOT NULL DEFAULT false,
    PRIMARY KEY (id),
    UNIQUE (transaction_id, position),
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id),
    CHECK ((original_amount IS NULL) = (original_instrument IS NULL))
);
CREATE INDEX ledger_posting_booked_idx ON ledger_posting (account_id, booked_on) INCLUDE (amount) WHERE NOT voided;
CREATE INDEX ledger_posting_settled_idx ON ledger_posting (account_id, coalesce(settled_on, booked_on)) INCLUDE (amount) WHERE NOT voided;
CREATE INDEX ledger_posting_transaction_idx ON ledger_posting (transaction_id);

CREATE TABLE ledger_link (
    id                  uuid   NOT NULL DEFAULT uuidv7(),
    user_id             bigint NOT NULL,
    from_transaction_id uuid   NOT NULL,
    to_transaction_id   uuid   NOT NULL,
    link_type           text   NOT NULL CHECK (link_type IN ('refund_of', 'reimbursement_of', 'cancellation_of', 'anticipation_of', 'chargeback_of', 'correction_of')),
    PRIMARY KEY (id),
    UNIQUE (from_transaction_id, to_transaction_id, link_type),
    FOREIGN KEY (user_id, from_transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, to_transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    CHECK (from_transaction_id <> to_transaction_id)
);
CREATE INDEX ledger_link_to_idx ON ledger_link (to_transaction_id);

-- I01, I02: checked at commit for every transaction whose postings changed.
-- +goose StatementBegin
CREATE FUNCTION ledger_check_transaction_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    tx_id uuid := coalesce(NEW.transaction_id, OLD.transaction_id);
    voided boolean;
    n int;
    total numeric;
BEGIN
    SELECT voided_at IS NOT NULL INTO voided FROM ledger_transaction WHERE id = tx_id;
    IF voided IS NULL OR voided THEN
        RETURN NULL;
    END IF;
    SELECT count(*), coalesce(sum(weight), 0) INTO n, total FROM ledger_posting WHERE transaction_id = tx_id;
    IF n < 2 THEN
        RAISE EXCEPTION 'transaction % has % postings; at least 2 required', tx_id, n USING ERRCODE = 'check_violation';
    END IF;
    IF total <> 0 THEN
        RAISE EXCEPTION 'transaction % is unbalanced by %', tx_id, total USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;
-- +goose StatementEnd
CREATE CONSTRAINT TRIGGER ledger_posting_balance
    AFTER INSERT OR UPDATE OR DELETE ON ledger_posting
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION ledger_check_transaction_balance();

-- I09: the account is open on the booking date; same check on account close.
-- +goose StatementBegin
CREATE FUNCTION ledger_check_account_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    a record;
BEGIN
    SELECT opened_on, closed_on INTO a FROM ledger_account WHERE id = NEW.account_id;
    IF NEW.booked_on < a.opened_on OR (a.closed_on IS NOT NULL AND NEW.booked_on > a.closed_on) THEN
        RAISE EXCEPTION 'account % is not open on %', NEW.account_id, NEW.booked_on USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER ledger_posting_account_open
    BEFORE INSERT OR UPDATE OF account_id, booked_on ON ledger_posting
    FOR EACH ROW EXECUTE FUNCTION ledger_check_account_open();

-- booked_on mirrors the transaction date.
-- +goose StatementBegin
CREATE FUNCTION ledger_sync_booked_on() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ledger_posting SET booked_on = NEW.date WHERE transaction_id = NEW.id AND booked_on <> NEW.date;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER ledger_transaction_date_sync
    AFTER UPDATE OF date ON ledger_transaction
    FOR EACH ROW EXECUTE FUNCTION ledger_sync_booked_on();

-- Un-voiding is not allowed; voiding marks the postings.
-- +goose StatementBegin
CREATE FUNCTION ledger_forbid_unvoid() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.voided_at IS NOT NULL AND NEW.voided_at IS NULL THEN
        RAISE EXCEPTION 'transaction % is voided and cannot be restored', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION ledger_mark_postings_voided() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ledger_posting SET voided = true WHERE transaction_id = NEW.id;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER ledger_transaction_voided
    AFTER UPDATE OF voided_at ON ledger_transaction
    FOR EACH ROW WHEN (OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL)
    EXECUTE FUNCTION ledger_mark_postings_voided();
CREATE TRIGGER ledger_transaction_unvoid
    BEFORE UPDATE OF voided_at ON ledger_transaction
    FOR EACH ROW EXECUTE FUNCTION ledger_forbid_unvoid();

-- +goose Down
DROP TABLE ledger_link, ledger_posting, ledger_transaction_tag, ledger_transaction_version,
    ledger_transaction, ledger_tag, ledger_account, ledger_payee, ledger_institution, ledger_settings;
DROP FUNCTION ledger_check_transaction_balance, ledger_check_account_open, ledger_sync_booked_on, ledger_forbid_unvoid, ledger_mark_postings_voided;

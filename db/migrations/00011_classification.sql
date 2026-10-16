-- +goose Up
CREATE TABLE classification_rule (
    id              uuid        NOT NULL DEFAULT uuidv7(),
    user_id         bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    name            text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    priority        int         NOT NULL CHECK (priority > 0),
    enabled         boolean     NOT NULL,
    stop_processing boolean     NOT NULL,
    conditions      jsonb       NOT NULL CHECK (jsonb_typeof(conditions) = 'array'),
    actions         jsonb       NOT NULL CHECK (jsonb_typeof(actions) = 'array'),
    schema_version  smallint    NOT NULL CHECK (schema_version = 1),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    -- Deferrable so that a reorder can swap priorities inside one transaction.
    CONSTRAINT classification_rule_priority_key UNIQUE (user_id, priority) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE classification_payee_alias (
    id         uuid        NOT NULL DEFAULT uuidv7(),
    user_id    bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    pattern    text        NOT NULL CHECK (length(pattern) BETWEEN 1 AND 200),
    match_type text        NOT NULL CHECK (match_type IN ('equals', 'starts_with', 'contains', 'regex')),
    payee_id   uuid        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    UNIQUE (user_id, match_type, pattern),
    FOREIGN KEY (user_id, payee_id) REFERENCES ledger_payee (user_id, id) ON DELETE CASCADE
);

CREATE TABLE classification_suggestion (
    id                      uuid        NOT NULL DEFAULT uuidv7(),
    user_id                 bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    fingerprint             text        NOT NULL,
    conditions              jsonb       NOT NULL,
    actions                 jsonb       NOT NULL,
    example_transaction_ids uuid[]      NOT NULL CHECK (cardinality(example_transaction_ids) BETWEEN 2 AND 10),
    state                   text        NOT NULL CHECK (state IN ('pending', 'accepted', 'dismissed')),
    rule_id                 uuid,
    created_at              timestamptz NOT NULL,
    decided_at              timestamptz,
    PRIMARY KEY (id),
    UNIQUE (user_id, fingerprint),
    FOREIGN KEY (user_id, rule_id) REFERENCES classification_rule (user_id, id) ON DELETE SET NULL (rule_id),
    CHECK (rule_id IS NULL OR state = 'accepted'),
    CHECK ((state = 'pending') = (decided_at IS NULL))
);

-- One row per transaction with category postings (P5 amendment A20); method NULL while uncategorized.
CREATE TABLE classification_categorization (
    transaction_id      uuid        NOT NULL,
    user_id             bigint      NOT NULL,
    transaction_version int         NOT NULL CHECK (transaction_version >= 1),
    transaction_date    date        NOT NULL,
    method              text        CHECK (method IN ('rule', 'source', 'history', 'manual')),
    rule_id             uuid,
    corrected           boolean     NOT NULL DEFAULT false,
    match_key           text,
    category_id         uuid,
    voided              boolean     NOT NULL DEFAULT false,
    decided_at          timestamptz NOT NULL,
    PRIMARY KEY (transaction_id),
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, rule_id) REFERENCES classification_rule (user_id, id) ON DELETE SET NULL (rule_id),
    CHECK (rule_id IS NULL OR method = 'rule'),
    CHECK (NOT corrected OR method = 'manual')
);
CREATE INDEX classification_categorization_date_idx ON classification_categorization (user_id, transaction_date) WHERE NOT voided;
CREATE INDEX classification_categorization_corrected_idx ON classification_categorization (user_id, match_key, category_id) WHERE corrected AND NOT voided;
CREATE INDEX classification_categorization_pending_idx ON classification_categorization (user_id, transaction_date, transaction_id) WHERE method IS NULL AND NOT voided;

-- +goose Down
DROP TABLE classification_categorization;
DROP TABLE classification_suggestion;
DROP TABLE classification_payee_alias;
DROP TABLE classification_rule;

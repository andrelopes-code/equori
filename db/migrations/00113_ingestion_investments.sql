-- +goose Up
CREATE TABLE ingestion_external_investment (
    id                  uuid   NOT NULL DEFAULT uuidv7(),
    books_id            bigint NOT NULL,
    connection_id       uuid   NOT NULL,
    external_id         text   NOT NULL,
    type                text   NOT NULL CHECK (type ~ '^[a-z0-9_]{2,40}$'),
    subtype             text   NOT NULL DEFAULT '' CHECK (subtype = '' OR subtype ~ '^[a-z0-9_]{2,40}$'),
    name                text   NOT NULL,
    issuer              text   NOT NULL DEFAULT '',
    issuer_scheme       text   NOT NULL DEFAULT '' CHECK (issuer_scheme = '' OR issuer_scheme ~ '^[a-z0-9_]{2,40}$'),
    issuer_id           text   NOT NULL DEFAULT '',
    index_id            text   NOT NULL DEFAULT '' CHECK (index_id = '' OR index_id ~ '^[a-z0-9_]{2,40}$'),
    percent_of_index_bp integer NOT NULL DEFAULT 0,
    spread_bp           integer NOT NULL DEFAULT 0,
    has_terms           boolean NOT NULL DEFAULT false,
    issued_on           date,
    matures_on          date,
    quantity            text   NOT NULL DEFAULT '',
    balance             bigint NOT NULL,
    currency            text   NOT NULL,
    balance_date        date   NOT NULL,
    brokerage_id        uuid,
    account_id          uuid,
    instrument          text,
    PRIMARY KEY (id),
    UNIQUE (books_id, id),
    UNIQUE (connection_id, external_id),
    FOREIGN KEY (books_id, connection_id) REFERENCES ingestion_connection (books_id, id) ON DELETE CASCADE
        DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE ingestion_investment_movement (
    id             uuid   NOT NULL DEFAULT uuidv7(),
    books_id       bigint NOT NULL,
    investment_id  uuid   NOT NULL,
    external_id    text   NOT NULL,
    kind           text   NOT NULL CHECK (kind ~ '^[a-z0-9_]{2,40}$'),
    moved_on       date   NOT NULL,
    quantity       text   NOT NULL DEFAULT '',
    amount         bigint NOT NULL,
    state          text   NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'confirmed', 'dismissed')),
    transaction_id uuid,
    application_id uuid   NOT NULL DEFAULT uuidv7(),
    PRIMARY KEY (id),
    UNIQUE (investment_id, external_id),
    FOREIGN KEY (books_id, investment_id) REFERENCES ingestion_external_investment (books_id, id) ON DELETE CASCADE
        DEFERRABLE INITIALLY IMMEDIATE,
    CHECK ((state = 'confirmed') = (transaction_id IS NOT NULL) OR kind = 'tax')
);

-- +goose Down
DROP TABLE ingestion_investment_movement;
DROP TABLE ingestion_external_investment;

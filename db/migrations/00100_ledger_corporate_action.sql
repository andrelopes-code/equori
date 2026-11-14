-- +goose Up
-- A228 IO26: D1 detail of a split, a reverse split or a bonus of one holding.
CREATE TABLE ledger_corporate_action (
    transaction_id     uuid            NOT NULL,
    books_id           bigint          NOT NULL,
    account_id         uuid            NOT NULL,
    kind               text            NOT NULL CHECK (kind IN ('split', 'reverse_split', 'bonus')),
    ratio_from         bigint          NOT NULL CHECK (ratio_from BETWEEN 1 AND 1000000),
    ratio_to           bigint          NOT NULL CHECK (ratio_to BETWEEN 1 AND 1000000),
    held               bigint          NOT NULL CHECK (held > 0),
    received           bigint          NOT NULL CHECK (received > 0),
    fraction_remainder bigint          NOT NULL CHECK (fraction_remainder >= 0 AND fraction_remainder < ratio_from),
    unit_cost          numeric(30, 12) CHECK (unit_cost > 0),
    value              bigint          NOT NULL DEFAULT 0 CHECK (value >= 0),
    PRIMARY KEY (transaction_id),
    FOREIGN KEY (books_id, transaction_id) REFERENCES ledger_transaction (books_id, id),
    FOREIGN KEY (books_id, account_id) REFERENCES ledger_account (books_id, id),
    CHECK ((kind = 'reverse_split') = (ratio_to < ratio_from)),
    CHECK (kind = 'bonus' OR (unit_cost IS NULL AND value = 0))
);

CREATE INDEX ledger_corporate_action_account ON ledger_corporate_action (account_id);

-- +goose Down
DROP TABLE ledger_corporate_action;

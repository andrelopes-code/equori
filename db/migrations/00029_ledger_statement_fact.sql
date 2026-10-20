-- +goose Up
-- A85: what an institution reported for a card statement; an owner fact wins over an
-- aggregator one. The statement's own dates are the effective ones (A86).
CREATE TABLE ledger_statement_fact (
    user_id      bigint      NOT NULL,
    statement_id uuid        NOT NULL,
    source       text        NOT NULL CHECK (source IN ('aggregator', 'owner')),
    closing_date date,
    due_date     date        NOT NULL,
    total        bigint      NOT NULL CHECK (abs(total) <= 9007199254740991),
    minimum      bigint      CHECK (minimum IS NULL OR (minimum >= 0 AND minimum <= 9007199254740991)),
    reported_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (statement_id, source),
    FOREIGN KEY (user_id, statement_id) REFERENCES ledger_statement (user_id, id) ON DELETE CASCADE,
    CHECK (closing_date IS NULL OR due_date > closing_date)
);

-- +goose Down
DROP TABLE ledger_statement_fact;

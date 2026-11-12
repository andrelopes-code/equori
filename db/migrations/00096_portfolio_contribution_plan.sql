-- +goose Up
-- Contribution plan (docs/specs/2026-11-12-contribution-plan-design.md, CN1 to CN4).
CREATE TABLE portfolio_contribution_plan (
    books_id bigint NOT NULL PRIMARY KEY REFERENCES identity_books (id) ON DELETE CASCADE,
    amount   bigint CHECK (amount > 0),
    currency text REFERENCES marketdata_instrument (code),
    CHECK ((amount IS NULL) = (currency IS NULL))
);

CREATE TABLE portfolio_contribution_class (
    id        uuid    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    books_id  bigint  NOT NULL REFERENCES portfolio_contribution_plan (books_id) ON DELETE CASCADE,
    position  integer NOT NULL CHECK (position BETWEEN 0 AND 19),
    name      text    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    target_bp integer NOT NULL CHECK (target_bp BETWEEN 0 AND 10000),
    UNIQUE (books_id, position),
    UNIQUE (books_id, id)
);

CREATE UNIQUE INDEX portfolio_contribution_class_name ON portfolio_contribution_class (books_id, lower(name));

CREATE TABLE portfolio_contribution_member (
    books_id   bigint  NOT NULL,
    class_id   uuid    NOT NULL,
    position   integer NOT NULL CHECK (position >= 0),
    account_id uuid,
    instrument text REFERENCES marketdata_instrument (code) ON DELETE CASCADE,
    target_bp  integer CHECK (target_bp BETWEEN 0 AND 10000),
    PRIMARY KEY (class_id, position),
    FOREIGN KEY (books_id, class_id) REFERENCES portfolio_contribution_class (books_id, id) ON DELETE CASCADE,
    FOREIGN KEY (books_id, account_id) REFERENCES ledger_account (books_id, id) ON DELETE CASCADE,
    CHECK ((account_id IS NULL) <> (instrument IS NULL))
);

CREATE UNIQUE INDEX portfolio_contribution_member_account ON portfolio_contribution_member (books_id, account_id)
    WHERE account_id IS NOT NULL;
CREATE UNIQUE INDEX portfolio_contribution_member_instrument ON portfolio_contribution_member (books_id, instrument)
    WHERE instrument IS NOT NULL;

-- +goose Down
DROP TABLE portfolio_contribution_member;
DROP TABLE portfolio_contribution_class;
DROP TABLE portfolio_contribution_plan;

-- +goose Up
-- Income buckets (docs/specs/2026-11-15-income-buckets-design.md, A229).
CREATE TABLE planning_bucket (
    id            uuid    NOT NULL PRIMARY KEY DEFAULT uuidv7(),
    books_id      bigint  NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    position      integer NOT NULL CHECK (position BETWEEN 0 AND 9),
    name          text    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    share_bp      integer NOT NULL CHECK (share_bp BETWEEN 0 AND 10000),
    takes_savings boolean NOT NULL DEFAULT false,
    UNIQUE (books_id, position),
    UNIQUE (books_id, id)
);

CREATE UNIQUE INDEX planning_bucket_name ON planning_bucket (books_id, lower(name));
CREATE UNIQUE INDEX planning_bucket_savings ON planning_bucket (books_id) WHERE takes_savings;

CREATE TABLE planning_bucket_category (
    books_id    bigint NOT NULL,
    category_id uuid   NOT NULL,
    bucket_id   uuid   NOT NULL,
    PRIMARY KEY (books_id, category_id),
    FOREIGN KEY (books_id, bucket_id) REFERENCES planning_bucket (books_id, id) ON DELETE CASCADE,
    FOREIGN KEY (books_id, category_id) REFERENCES ledger_account (books_id, id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE planning_bucket_category;
DROP TABLE planning_bucket;

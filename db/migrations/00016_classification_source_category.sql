-- +goose Up
-- P6 amendment A41: each category an aggregator assigned to a line, how many lines carried
-- it, and the owner's category for it.
CREATE TABLE classification_source_category (
    id          uuid   NOT NULL DEFAULT uuidv7(),
    user_id     bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    provider    text   NOT NULL CHECK (provider IN ('pluggy')),
    external_id text   NOT NULL CHECK (length(external_id) BETWEEN 1 AND 100),
    name        text   NOT NULL,
    seen_count  int    NOT NULL DEFAULT 0 CHECK (seen_count >= 0),
    category_id uuid,
    PRIMARY KEY (id),
    UNIQUE (user_id, provider, external_id),
    FOREIGN KEY (user_id, category_id) REFERENCES ledger_account (user_id, id) ON DELETE SET NULL (category_id)
);
CREATE INDEX classification_source_category_list_idx ON classification_source_category (user_id, name, id);

-- +goose Down
DROP TABLE classification_source_category;

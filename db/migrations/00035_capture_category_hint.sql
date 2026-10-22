-- +goose Up
-- ADR 014 L4: the category a language model named for a normalized capture description, or
-- none (category_id null), so one description costs at most one model call.
CREATE TABLE capture_category_hint (
    user_id     bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    class       text        NOT NULL CHECK (class IN ('expense', 'income')),
    description text        NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
    category_id uuid,
    answered_at timestamptz NOT NULL,
    PRIMARY KEY (user_id, class, description),
    FOREIGN KEY (user_id, category_id) REFERENCES ledger_account (user_id, id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE capture_category_hint;

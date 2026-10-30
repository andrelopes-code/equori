-- +goose Up
-- HA1: the book name; HA2: the last visit of a membership.
ALTER TABLE identity_books ADD COLUMN name text;

UPDATE identity_books b
SET name = coalesce(
    (
        SELECT left(m.email, 80)
        FROM identity_membership ms
        JOIN identity_member m ON m.id = ms.member_id
        WHERE ms.books_id = b.id AND ms.role = 'owner'
        ORDER BY m.id
        LIMIT 1
    ),
    '#' || b.id
);

ALTER TABLE identity_books
    ALTER COLUMN name SET NOT NULL,
    ADD CONSTRAINT identity_books_name_check CHECK (char_length(name) BETWEEN 1 AND 80);

ALTER TABLE identity_membership ADD COLUMN last_active_at timestamptz NOT NULL DEFAULT now();
UPDATE identity_membership SET last_active_at = created_at;

-- +goose Down
ALTER TABLE identity_membership DROP COLUMN last_active_at;
ALTER TABLE identity_books DROP COLUMN name;

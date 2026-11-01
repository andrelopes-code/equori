-- +goose Up
-- Deleting a book (docs/superpowers/plans/2026-11-01-delete-books.md, DB5) cascades from identity_books into
-- every table; the composite keys between two tables of a book are checked after each cascaded statement and
-- would stop it. They become deferrable, still checked at once, so the delete defers them to the commit.
-- +goose StatementBegin
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT k.conrelid::regclass AS tbl, k.conname
        FROM pg_constraint k
        WHERE k.contype = 'f'
          AND k.confdeltype = 'a'
          AND NOT k.condeferrable
          AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = k.conrelid AND a.attname = 'books_id' AND NOT a.attisdropped)
          AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = k.confrelid AND a.attname = 'books_id' AND NOT a.attisdropped)
    LOOP
        EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE', c.tbl, c.conname);
    END LOOP;
END $$;
-- +goose StatementEnd

-- ON DELETE RESTRICT cannot be deferred; NO ACTION refuses the same delete at the end of the statement.
ALTER TABLE ingestion_connection DROP CONSTRAINT ingestion_connection_integration_fkey;
ALTER TABLE ingestion_connection ADD CONSTRAINT ingestion_connection_integration_fkey
    FOREIGN KEY (books_id, integration_id) REFERENCES ingestion_integration (books_id, id)
    DEFERRABLE INITIALLY IMMEDIATE;

-- +goose Down
ALTER TABLE ingestion_connection DROP CONSTRAINT ingestion_connection_integration_fkey;
ALTER TABLE ingestion_connection ADD CONSTRAINT ingestion_connection_integration_fkey
    FOREIGN KEY (books_id, integration_id) REFERENCES ingestion_integration (books_id, id) ON DELETE RESTRICT;

-- +goose StatementBegin
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT k.conrelid::regclass AS tbl, k.conname
        FROM pg_constraint k
        WHERE k.contype = 'f'
          AND k.confdeltype = 'a'
          AND k.condeferrable
          AND NOT k.condeferred
          AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = k.conrelid AND a.attname = 'books_id' AND NOT a.attisdropped)
          AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = k.confrelid AND a.attname = 'books_id' AND NOT a.attisdropped)
    LOOP
        EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I NOT DEFERRABLE', c.tbl, c.conname);
    END LOOP;
END $$;
-- +goose StatementEnd

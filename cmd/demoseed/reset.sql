-- Deletes the demo member, its book and every row the book owns. The foreign keys of the ledger forbid a cascade, so the rows go with the checks off.
BEGIN;
SET LOCAL session_replication_role = replica;
DO $$
DECLARE
    t text;
    fk record;
    n bigint;
    gone bigint;
    demo_member bigint := (SELECT id FROM identity_member WHERE email = '@EMAIL@');
    demo_books bigint := (SELECT books_id FROM identity_membership WHERE member_id = demo_member AND role = 'owner' ORDER BY books_id LIMIT 1);
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'books_id'
    LOOP
        EXECUTE format('DELETE FROM %I WHERE books_id = $1', t) USING demo_books;
    END LOOP;
    DELETE FROM identity_session WHERE member_id = demo_member OR books_id = demo_books;
    DELETE FROM identity_access_token WHERE member_id = demo_member OR books_id = demo_books;
    DELETE FROM identity_membership WHERE member_id = demo_member OR books_id = demo_books;
    DELETE FROM identity_books WHERE id = demo_books;
    DELETE FROM identity_member WHERE id = demo_member;
    -- With the checks off, ON DELETE CASCADE does not run: a table without books_id (the prices and
    -- terms of a security of the book) keeps rows whose parent is gone. Each pass deletes them, until
    -- a pass deletes nothing (terms, then their payments).
    LOOP
        gone := 0;
        FOR fk IN
            SELECT conrelid::regclass AS child, confrelid::regclass AS parent,
                   a.attname AS col, b.attname AS ref
            FROM pg_constraint
            JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = conkey[1]
            JOIN pg_attribute b ON b.attrelid = confrelid AND b.attnum = confkey[1]
            WHERE contype = 'f' AND confdeltype = 'c' AND cardinality(conkey) = 1
        LOOP
            EXECUTE format(
                'DELETE FROM %s c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %s p WHERE p.%I = c.%I)',
                fk.child, fk.col, fk.parent, fk.ref, fk.col);
            GET DIAGNOSTICS n = ROW_COUNT;
            gone := gone + n;
        END LOOP;
        EXIT WHEN gone = 0;
    END LOOP;
END $$;
COMMIT;

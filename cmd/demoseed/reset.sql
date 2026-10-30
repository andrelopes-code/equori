-- Deletes the demo member, its book and every row the book owns. The foreign keys of the ledger forbid a cascade, so the rows go with the checks off.
BEGIN;
SET LOCAL session_replication_role = replica;
DO $$
DECLARE
    t text;
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
END $$;
COMMIT;

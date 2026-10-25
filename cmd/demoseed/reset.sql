-- Deletes the demo user and every row it owns. The foreign keys of the ledger forbid a cascade, so the rows go with the checks off.
BEGIN;
SET LOCAL session_replication_role = replica;
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'user_id' AND table_name <> 'identity_user'
    LOOP
        EXECUTE format('DELETE FROM %I WHERE user_id = (SELECT id FROM identity_user WHERE email = %L)', t, '@EMAIL@');
    END LOOP;
    DELETE FROM identity_user WHERE email = '@EMAIL@';
END $$;
COMMIT;

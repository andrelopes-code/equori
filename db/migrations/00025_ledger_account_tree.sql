-- +goose Up
-- A73: an account is never its own ancestor. UNION (not UNION ALL) ends the walk on rows
-- that already form a cycle.
-- +goose StatementBegin
CREATE FUNCTION ledger_check_account_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF EXISTS (
        WITH RECURSIVE up(id) AS (
            SELECT NEW.parent_id
            UNION
            SELECT a.parent_id FROM ledger_account a JOIN up ON a.id = up.id WHERE a.parent_id IS NOT NULL
        )
        SELECT 1 FROM up WHERE id = NEW.id
    ) THEN
        RAISE EXCEPTION 'account % would be its own ancestor', NEW.id USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER ledger_account_no_cycle
    BEFORE INSERT OR UPDATE OF parent_id ON ledger_account
    FOR EACH ROW EXECUTE FUNCTION ledger_check_account_cycle();

-- +goose Down
DROP TRIGGER ledger_account_no_cycle ON ledger_account;
DROP FUNCTION ledger_check_account_cycle();

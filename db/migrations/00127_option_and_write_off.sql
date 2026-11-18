-- +goose Up
-- Listed options design O1 and O3: an instrument of type option, and a trade that writes off a
-- quantity of a holding at zero proceeds (an option expired, a right not exercised, a security
-- that became worthless).
ALTER TABLE marketdata_instrument DROP CONSTRAINT marketdata_instrument_instrument_type_check;
ALTER TABLE marketdata_instrument ADD CONSTRAINT marketdata_instrument_instrument_type_check
    CHECK (instrument_type IN (
        'currency', 'stock', 'etf', 'reit', 'depositary_receipt', 'fixed_income', 'fund', 'crypto',
        'option'
    ));

ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_side_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_side_check
    CHECK (side IN ('buy', 'sell', 'write_off'));
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_unit_price_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_unit_price_check
    CHECK ((side = 'write_off') = (unit_price = 0) AND unit_price >= 0);
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_gross_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_gross_check
    CHECK ((side = 'write_off') = (gross = 0) AND gross >= 0);
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_check
    CHECK ((side IN ('sell', 'write_off')) = (cost IS NOT NULL));
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_write_off
    CHECK (side <> 'write_off' OR (fees = 0 AND taxes = 0 AND cash_account_id = account_id));

-- I01 gains one exception: a write-off of units that hold no cost is one posting of weight zero.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION ledger_check_transaction_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    tx_id uuid := coalesce(NEW.transaction_id, OLD.transaction_id);
    voided boolean;
    n int;
    total numeric;
BEGIN
    SELECT voided_at IS NOT NULL INTO voided FROM ledger_transaction WHERE id = tx_id;
    IF voided IS NULL OR voided THEN
        RETURN NULL;
    END IF;
    SELECT count(*), coalesce(sum(weight), 0) INTO n, total FROM ledger_posting WHERE transaction_id = tx_id;
    IF n < 2 AND NOT (
        n = 1 AND total = 0
        AND EXISTS (SELECT 1 FROM ledger_trade WHERE transaction_id = tx_id AND side = 'write_off')
    ) THEN
        RAISE EXCEPTION 'transaction % has % postings; at least 2 required', tx_id, n USING ERRCODE = 'check_violation';
    END IF;
    IF total <> 0 THEN
        RAISE EXCEPTION 'transaction % is unbalanced by %', tx_id, total USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;
-- +goose StatementEnd

-- +goose Down
DELETE FROM ledger_transaction t USING ledger_trade d
WHERE d.side = 'write_off' AND t.books_id = d.books_id AND t.id = d.transaction_id;
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION ledger_check_transaction_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    tx_id uuid := coalesce(NEW.transaction_id, OLD.transaction_id);
    voided boolean;
    n int;
    total numeric;
BEGIN
    SELECT voided_at IS NOT NULL INTO voided FROM ledger_transaction WHERE id = tx_id;
    IF voided IS NULL OR voided THEN
        RETURN NULL;
    END IF;
    SELECT count(*), coalesce(sum(weight), 0) INTO n, total FROM ledger_posting WHERE transaction_id = tx_id;
    IF n < 2 THEN
        RAISE EXCEPTION 'transaction % has % postings; at least 2 required', tx_id, n USING ERRCODE = 'check_violation';
    END IF;
    IF total <> 0 THEN
        RAISE EXCEPTION 'transaction % is unbalanced by %', tx_id, total USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;
-- +goose StatementEnd
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_write_off;
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_check
    CHECK ((side = 'sell') = (cost IS NOT NULL));
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_gross_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_gross_check CHECK (gross > 0);
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_unit_price_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_unit_price_check CHECK (unit_price > 0);
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_side_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_side_check CHECK (side IN ('buy', 'sell'));
DELETE FROM marketdata_instrument WHERE instrument_type = 'option';
ALTER TABLE marketdata_instrument DROP CONSTRAINT marketdata_instrument_instrument_type_check;
ALTER TABLE marketdata_instrument ADD CONSTRAINT marketdata_instrument_instrument_type_check
    CHECK (instrument_type IN (
        'currency', 'stock', 'etf', 'reit', 'depositary_receipt', 'fixed_income', 'fund', 'crypto'
    ));

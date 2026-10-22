-- +goose Up
ALTER TABLE marketdata_instrument
    DROP CONSTRAINT marketdata_instrument_instrument_type_check,
    DROP CONSTRAINT marketdata_instrument_exchange_check;

UPDATE marketdata_instrument SET exchange = 'BVMF' WHERE exchange = 'B3';
UPDATE marketdata_instrument SET instrument_type = 'reit' WHERE instrument_type = 'fii';
UPDATE marketdata_instrument SET instrument_type = 'depositary_receipt' WHERE instrument_type = 'bdr';
UPDATE portfolio_realized_result SET tax_class = 'reit' WHERE tax_class = 'fii';
UPDATE portfolio_realized_result SET tax_class = 'depositary_receipt' WHERE tax_class = 'bdr';

ALTER TABLE marketdata_instrument
    ADD CONSTRAINT marketdata_instrument_instrument_type_check
        CHECK (instrument_type IN ('currency', 'stock', 'etf', 'reit', 'depositary_receipt', 'fixed_income', 'fund', 'crypto')),
    ADD CONSTRAINT marketdata_instrument_exchange_check
        CHECK (exchange ~ '^[A-Z0-9]{4}$');

-- +goose Down
ALTER TABLE marketdata_instrument
    DROP CONSTRAINT marketdata_instrument_instrument_type_check,
    DROP CONSTRAINT marketdata_instrument_exchange_check;
UPDATE marketdata_instrument SET exchange = 'B3' WHERE exchange = 'BVMF';
UPDATE marketdata_instrument SET instrument_type = 'fii' WHERE instrument_type = 'reit';
UPDATE marketdata_instrument SET instrument_type = 'bdr' WHERE instrument_type = 'depositary_receipt';
UPDATE portfolio_realized_result SET tax_class = 'fii' WHERE tax_class = 'reit';
UPDATE portfolio_realized_result SET tax_class = 'bdr' WHERE tax_class = 'depositary_receipt';
ALTER TABLE marketdata_instrument
    ADD CONSTRAINT marketdata_instrument_instrument_type_check
        CHECK (instrument_type IN ('currency', 'stock', 'fii', 'etf', 'bdr', 'fixed_income', 'fund', 'crypto')),
    ADD CONSTRAINT marketdata_instrument_exchange_check CHECK (exchange IN ('B3'));

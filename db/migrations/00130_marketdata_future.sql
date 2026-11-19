-- +goose Up
-- Coverage row E-12: an instrument of type future, a contract listed on an exchange traded at its
-- value in the quote currency per contract.
ALTER TABLE marketdata_instrument DROP CONSTRAINT marketdata_instrument_instrument_type_check;
ALTER TABLE marketdata_instrument ADD CONSTRAINT marketdata_instrument_instrument_type_check
    CHECK (instrument_type IN (
        'currency', 'stock', 'etf', 'reit', 'depositary_receipt', 'fixed_income', 'fund', 'crypto',
        'option', 'future'
    ));

-- +goose Down
DELETE FROM marketdata_instrument WHERE instrument_type = 'future';
ALTER TABLE marketdata_instrument DROP CONSTRAINT marketdata_instrument_instrument_type_check;
ALTER TABLE marketdata_instrument ADD CONSTRAINT marketdata_instrument_instrument_type_check
    CHECK (instrument_type IN (
        'currency', 'stock', 'etf', 'reit', 'depositary_receipt', 'fixed_income', 'fund', 'crypto',
        'option'
    ));

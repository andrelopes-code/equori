-- +goose Up
CREATE TABLE marketdata_instrument (
    code            text     PRIMARY KEY CHECK (code ~ '^[A-Z0-9.]{2,20}$'),
    instrument_type text     NOT NULL CHECK (instrument_type IN ('currency', 'stock', 'fii', 'etf', 'bdr', 'fixed_income', 'fund', 'crypto')),
    scale           smallint NOT NULL CHECK (scale BETWEEN 0 AND 12),
    name            text     NOT NULL
);

INSERT INTO marketdata_instrument (code, instrument_type, scale, name) VALUES
    ('ARS', 'currency', 2, 'Argentine peso'),
    ('AUD', 'currency', 2, 'Australian dollar'),
    ('BRL', 'currency', 2, 'Brazilian real'),
    ('CAD', 'currency', 2, 'Canadian dollar'),
    ('CHF', 'currency', 2, 'Swiss franc'),
    ('CLP', 'currency', 0, 'Chilean peso'),
    ('CNY', 'currency', 2, 'Chinese yuan'),
    ('COP', 'currency', 2, 'Colombian peso'),
    ('EUR', 'currency', 2, 'Euro'),
    ('GBP', 'currency', 2, 'Pound sterling'),
    ('JPY', 'currency', 0, 'Japanese yen'),
    ('MXN', 'currency', 2, 'Mexican peso'),
    ('PYG', 'currency', 0, 'Paraguayan guaraní'),
    ('USD', 'currency', 2, 'US dollar'),
    ('UYU', 'currency', 2, 'Uruguayan peso');

-- +goose Down
DROP TABLE marketdata_instrument;

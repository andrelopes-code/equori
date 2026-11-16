-- +goose Up
-- Fixed income complete A236 FC1, FC3: a contract owned by one book and the issuer of a security.
ALTER TABLE marketdata_instrument
    ADD COLUMN books_id bigint REFERENCES identity_books (id) ON DELETE CASCADE,
    ADD COLUMN issuer text CHECK (
        issuer IS NULL OR (issuer = btrim(issuer) AND char_length(issuer) BETWEEN 1 AND 80)
    ),
    ADD COLUMN issuer_scheme text CHECK (
        issuer_scheme IS NULL OR issuer_scheme ~ '^[a-z0-9_]{2,40}$'
    ),
    ADD COLUMN issuer_id text CHECK (
        issuer_id IS NULL OR char_length(issuer_id) BETWEEN 1 AND 40
    ),
    ADD CONSTRAINT marketdata_instrument_owner_type CHECK (
        books_id IS NULL OR instrument_type = 'fixed_income'
    ),
    ADD CONSTRAINT marketdata_instrument_issuer_key CHECK (
        (issuer_scheme IS NULL) = (issuer_id IS NULL)
    );

CREATE INDEX marketdata_instrument_books_idx ON marketdata_instrument (books_id)
WHERE books_id IS NOT NULL;

-- The deletion of a book removes its instruments with their prices, terms and history.
ALTER TABLE marketdata_price
    DROP CONSTRAINT marketdata_price_instrument_fkey,
    ADD CONSTRAINT marketdata_price_instrument_fkey FOREIGN KEY (instrument)
        REFERENCES marketdata_instrument (code) ON DELETE CASCADE;

ALTER TABLE marketdata_fixed_income_terms
    DROP CONSTRAINT marketdata_fixed_income_terms_instrument_code_fkey,
    ADD CONSTRAINT marketdata_fixed_income_terms_instrument_code_fkey FOREIGN KEY (instrument_code)
        REFERENCES marketdata_instrument (code) ON DELETE CASCADE;

ALTER TABLE marketdata_history
    DROP CONSTRAINT marketdata_history_instrument_fkey,
    ADD CONSTRAINT marketdata_history_instrument_fkey FOREIGN KEY (instrument)
        REFERENCES marketdata_instrument (code) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE marketdata_history
    DROP CONSTRAINT marketdata_history_instrument_fkey,
    ADD CONSTRAINT marketdata_history_instrument_fkey FOREIGN KEY (instrument)
        REFERENCES marketdata_instrument (code);

ALTER TABLE marketdata_fixed_income_terms
    DROP CONSTRAINT marketdata_fixed_income_terms_instrument_code_fkey,
    ADD CONSTRAINT marketdata_fixed_income_terms_instrument_code_fkey FOREIGN KEY (instrument_code)
        REFERENCES marketdata_instrument (code);

ALTER TABLE marketdata_price
    DROP CONSTRAINT marketdata_price_instrument_fkey,
    ADD CONSTRAINT marketdata_price_instrument_fkey FOREIGN KEY (instrument)
        REFERENCES marketdata_instrument (code);

DROP INDEX marketdata_instrument_books_idx;

ALTER TABLE marketdata_instrument
    DROP CONSTRAINT marketdata_instrument_issuer_key,
    DROP CONSTRAINT marketdata_instrument_owner_type,
    DROP COLUMN issuer_id,
    DROP COLUMN issuer_scheme,
    DROP COLUMN issuer,
    DROP COLUMN books_id;

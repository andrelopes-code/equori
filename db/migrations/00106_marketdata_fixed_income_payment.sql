-- +goose Up
-- Fixed income complete A236 FC6: the dates a security pays interest or returns principal.
CREATE TABLE marketdata_fixed_income_payment (
    instrument_code text NOT NULL REFERENCES marketdata_fixed_income_terms (instrument_code) ON DELETE CASCADE,
    pays_on date NOT NULL,
    amortization_bp integer NOT NULL CHECK (amortization_bp BETWEEN 0 AND 10000),
    pays_interest boolean NOT NULL,
    PRIMARY KEY (instrument_code, pays_on),
    CHECK (pays_interest OR amortization_bp > 0)
);

-- +goose StatementBegin
CREATE FUNCTION marketdata_fixed_income_payment_sum() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (SELECT sum(amortization_bp) FROM marketdata_fixed_income_payment
        WHERE instrument_code = NEW.instrument_code) > 10000 THEN
        RAISE EXCEPTION 'amortizations of % sum to more than 10000 bp', NEW.instrument_code
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;
-- +goose StatementEnd

CREATE CONSTRAINT TRIGGER marketdata_fixed_income_payment_sum
    AFTER INSERT OR UPDATE ON marketdata_fixed_income_payment
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION marketdata_fixed_income_payment_sum();

-- +goose Down
DROP TABLE marketdata_fixed_income_payment;
DROP FUNCTION marketdata_fixed_income_payment_sum();

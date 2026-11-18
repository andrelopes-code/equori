-- +goose Up
-- Progressive rate design PR1, PR2: the rate a security takes after a number of days held, and
-- whether a step applies to the whole period since the issue or from its own day.
ALTER TABLE marketdata_fixed_income_terms
    ADD COLUMN rate_steps jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(rate_steps) = 'array'),
    ADD COLUMN rate_steps_apply text CHECK (rate_steps_apply IN ('retroactive', 'stepped')),
    ADD CONSTRAINT marketdata_fixed_income_terms_rate_steps
        CHECK ((rate_steps = '[]') = (rate_steps_apply IS NULL));

-- +goose Down
ALTER TABLE marketdata_fixed_income_terms
    DROP CONSTRAINT marketdata_fixed_income_terms_rate_steps,
    DROP COLUMN rate_steps_apply,
    DROP COLUMN rate_steps;

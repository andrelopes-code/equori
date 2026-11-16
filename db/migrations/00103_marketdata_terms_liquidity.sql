-- +goose Up
-- Fixed income complete A236 FC4, FC5: the calendar that counts the business days of a pre-fixed
-- or monthly-index security, its daily liquidity and the first date it can be redeemed.
ALTER TABLE marketdata_fixed_income_terms
    ADD COLUMN calendar_id text CHECK (calendar_id IS NULL OR calendar_id ~ '^[a-z0-9_]{2,40}$'),
    ADD COLUMN daily_liquidity boolean NOT NULL DEFAULT false,
    ADD COLUMN redeemable_from date,
    ADD CONSTRAINT marketdata_fixed_income_terms_redeemable CHECK (
        redeemable_from IS NULL OR (redeemable_from >= issued_on AND redeemable_from <= matures_on)
    ),
    DROP CONSTRAINT marketdata_fixed_income_terms_check1,
    ADD CONSTRAINT marketdata_fixed_income_terms_business_days CHECK (
        day_count = 'act365' OR index_id = 'cdi' OR calendar_id IS NOT NULL
    );

-- +goose Down
UPDATE marketdata_fixed_income_terms
SET day_count = 'act365'
WHERE day_count = 'bus252' AND index_id IS DISTINCT FROM 'cdi';

ALTER TABLE marketdata_fixed_income_terms
    DROP CONSTRAINT marketdata_fixed_income_terms_business_days,
    ADD CONSTRAINT marketdata_fixed_income_terms_check1 CHECK (day_count = 'act365' OR index_id = 'cdi'),
    DROP CONSTRAINT marketdata_fixed_income_terms_redeemable,
    DROP COLUMN redeemable_from,
    DROP COLUMN daily_liquidity,
    DROP COLUMN calendar_id;

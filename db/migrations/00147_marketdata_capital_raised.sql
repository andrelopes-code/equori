-- +goose Up
-- Company report CR4, CR5: whether the share capital of a fiscal year grew with new resources, and
-- whether a listed company is of the financial sector. Both are unknown until the source is read.
ALTER TABLE marketdata_company_report
    ADD COLUMN capital_raised boolean;

ALTER TABLE marketdata_company_listing
    ADD COLUMN financial boolean NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE marketdata_company_listing
    DROP COLUMN financial;

ALTER TABLE marketdata_company_report
    DROP COLUMN capital_raised;

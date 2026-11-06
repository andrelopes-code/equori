-- +goose Up
ALTER TABLE ingestion_csv_profile
    ADD COLUMN footer_rows integer NOT NULL DEFAULT 0 CHECK (footer_rows BETWEEN 0 AND 10),
    ADD COLUMN sign_column text,
    ADD COLUMN debit_marker text CHECK (char_length(debit_marker) BETWEEN 1 AND 40),
    ADD CONSTRAINT ingestion_csv_profile_sign_check CHECK (
        (sign_column IS NULL OR debit_marker IS NOT NULL)
        AND (debit_marker IS NULL OR amount_column IS NOT NULL)
    );

-- +goose Down
ALTER TABLE ingestion_csv_profile
    DROP CONSTRAINT ingestion_csv_profile_sign_check,
    DROP COLUMN debit_marker,
    DROP COLUMN sign_column,
    DROP COLUMN footer_rows;

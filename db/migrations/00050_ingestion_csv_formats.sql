-- +goose Up
ALTER TABLE ingestion_csv_profile DROP CONSTRAINT ingestion_csv_profile_date_layout_check;
ALTER TABLE ingestion_csv_profile
    ADD CONSTRAINT ingestion_csv_profile_date_layout_check
    CHECK (date_layout ~ '^(DD|MM|YYYY|YY)([/. -])(DD|MM|YYYY|YY)\2(DD|MM|YYYY|YY)$');
ALTER TABLE ingestion_csv_profile
    ADD COLUMN group_separator text NOT NULL DEFAULT '' CHECK (group_separator IN (',', '.', ' ', U&'\00A0', '''', ''));
UPDATE ingestion_csv_profile SET group_separator = CASE decimal_separator WHEN ',' THEN '.' ELSE ',' END;

-- +goose Down
ALTER TABLE ingestion_csv_profile DROP COLUMN group_separator;
ALTER TABLE ingestion_csv_profile DROP CONSTRAINT ingestion_csv_profile_date_layout_check;
ALTER TABLE ingestion_csv_profile
    ADD CONSTRAINT ingestion_csv_profile_date_layout_check
    CHECK (date_layout IN ('DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'));

-- name: GetProfile :one
SELECT
    *
FROM
    ingestion_csv_profile
WHERE
    user_id = $1
    AND account_id = $2;

-- name: UpsertProfile :one
-- The WHERE keeps another user's profile out of reach: no row comes back for it.
INSERT INTO
    ingestion_csv_profile (
        user_id,
        account_id,
        delimiter,
        header_rows,
        date_column,
        date_layout,
        amount_column,
        debit_column,
        credit_column,
        decimal_separator,
        description_column,
        id_column,
        amount_sign,
        encoding,
        group_separator
    )
VALUES
    (
        @user_id,
        @account_id,
        @delimiter,
        @header_rows,
        @date_column,
        @date_layout,
        sqlc.narg (amount_column),
        sqlc.narg (debit_column),
        sqlc.narg (credit_column),
        @decimal_separator,
        @description_column,
        sqlc.narg (id_column),
        @amount_sign,
        @encoding,
        @group_separator
    )
ON CONFLICT (account_id) DO UPDATE
SET
    delimiter = EXCLUDED.delimiter,
    header_rows = EXCLUDED.header_rows,
    date_column = EXCLUDED.date_column,
    date_layout = EXCLUDED.date_layout,
    amount_column = EXCLUDED.amount_column,
    debit_column = EXCLUDED.debit_column,
    credit_column = EXCLUDED.credit_column,
    decimal_separator = EXCLUDED.decimal_separator,
    description_column = EXCLUDED.description_column,
    id_column = EXCLUDED.id_column,
    amount_sign = EXCLUDED.amount_sign,
    encoding = EXCLUDED.encoding,
    group_separator = EXCLUDED.group_separator,
    updated_at = now()
WHERE
    ingestion_csv_profile.user_id = EXCLUDED.user_id
RETURNING
    *;

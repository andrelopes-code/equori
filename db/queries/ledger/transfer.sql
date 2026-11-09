-- name: PairingCandidates :many
-- P5b amendment A29: uncategorized imported transactions with the opposite side on the account;
-- a card payment waiting on transfers_in_transit is one too (A88).
SELECT
    t.id
FROM
    ledger_transaction t
WHERE
    t.books_id = @books_id
    AND t.id <> @transaction_id
    AND t.voided_at IS NULL
    AND t.origin = 'import'
    AND t.date BETWEEN @from_date::date AND @to_date::date
    AND EXISTS (
        SELECT
            1
        FROM
            ledger_posting p
        WHERE
            p.transaction_id = t.id
            AND p.account_id = @account_id
            AND p.amount = @amount
    )
    AND NOT EXISTS (
        SELECT
            1
        FROM
            ledger_posting p
        WHERE
            p.transaction_id = t.id
            AND p.account_id = ANY (@excluded_accounts::UUID[])
    )
    AND EXISTS (
        SELECT
            1
        FROM
            ledger_posting p
            JOIN ledger_account a ON a.id = p.account_id
        WHERE
            p.transaction_id = t.id
            AND a.system_role IN ('uncategorized_expense', 'uncategorized_income', 'transfers_in_transit')
    )
    AND NOT EXISTS (
        SELECT
            1
        FROM
            ledger_posting p
            JOIN ledger_account a ON a.id = p.account_id
        WHERE
            p.transaction_id = t.id
            AND a.account_class IN ('income', 'expense')
            AND a.system_role IS DISTINCT FROM 'uncategorized_expense'
            AND a.system_role IS DISTINCT FROM 'uncategorized_income'
    )
ORDER BY
    t.date,
    t.id;

-- name: ClearRecordLinks :exec
UPDATE ledger_posting
SET
    external_record_id = NULL
WHERE
    books_id = $1
    AND transaction_id = $2;

-- name: ImportCounterparts :many
-- A216 rule 2: imported transactions with a posting on another balance account of the book, in
-- the line's currency and of the given amount, posted and confirmed by a record, whose other
-- side is uncategorized or transfers_in_transit (A29, A88).
SELECT
    t.id AS transaction_id,
    p.account_id,
    p.external_record_id::uuid AS record_id,
    EXISTS (
        SELECT
            1
        FROM
            ledger_posting c
        WHERE
            c.transaction_id = t.id
            AND c.card_role = 'payment'
    ) AS card_payment
FROM
    ledger_transaction t
    JOIN ledger_posting p ON p.transaction_id = t.id
    JOIN ledger_account a ON a.id = p.account_id
WHERE
    t.books_id = @books_id
    AND t.voided_at IS NULL
    AND t.origin = 'import'
    AND t.date BETWEEN @from_date::date AND @to_date::date
    AND p.account_id <> @account_id
    AND a.account_class IN ('asset', 'liability')
    AND a.instrument = @currency
    AND p.amount = @amount
    AND p.status <> 'pending'
    AND p.external_record_id IS NOT NULL
    AND NOT EXISTS (
        SELECT
            1
        FROM
            ledger_posting x
        WHERE
            x.transaction_id = t.id
            AND x.account_id = @account_id
    )
    AND EXISTS (
        SELECT
            1
        FROM
            ledger_posting x
            JOIN ledger_account xa ON xa.id = x.account_id
        WHERE
            x.transaction_id = t.id
            AND xa.system_role IN ('uncategorized_expense', 'uncategorized_income', 'transfers_in_transit')
    )
    AND NOT EXISTS (
        SELECT
            1
        FROM
            ledger_posting x
            JOIN ledger_account xa ON xa.id = x.account_id
        WHERE
            x.transaction_id = t.id
            AND xa.account_class IN ('income', 'expense')
            AND xa.system_role IS DISTINCT FROM 'uncategorized_expense'
            AND xa.system_role IS DISTINCT FROM 'uncategorized_income'
    )
ORDER BY
    t.date,
    t.id,
    p.id;

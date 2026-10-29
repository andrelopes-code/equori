-- name: GetTransactionsByIDs :many
SELECT
    *
FROM
    ledger_transaction
WHERE
    user_id = $1
    AND id = ANY (@ids::UUID[]);

-- name: RawDescriptions :many
-- The description of version 1 survives in the first version snapshot (P5 amendment A26).
SELECT
    v.transaction_id,
    (v.snapshot ->> 'description')::text AS description
FROM
    ledger_transaction_version v
    JOIN ledger_transaction t ON t.id = v.transaction_id
WHERE
    t.user_id = $1
    AND v.transaction_id = ANY (@ids::UUID[])
    AND v.version = 1;

-- name: ListAllAccounts :many
SELECT
    *
FROM
    ledger_account
WHERE
    user_id = $1
ORDER BY
    id;

-- name: ExistingPayees :many
SELECT
    id
FROM
    ledger_payee
WHERE
    user_id = $1
    AND id = ANY (@ids::UUID[]);

-- name: LatestPayeeCategories :many
-- P5 amendment A23: transactions whose only category posting is categorized, latest first.
SELECT DISTINCT
    ON (t.payee_id, a.account_class) t.payee_id::uuid AS payee_id,
    a.account_class,
    p.account_id
FROM
    ledger_transaction t
    JOIN ledger_posting p ON p.transaction_id = t.id
    JOIN ledger_account a ON a.id = p.account_id
WHERE
    t.user_id = @user_id
    AND t.payee_id = ANY (@payee_ids::UUID[])
    AND t.voided_at IS NULL
    AND a.account_class IN ('income', 'expense')
    AND a.system_role IS DISTINCT FROM 'uncategorized_expense'
    AND a.system_role IS DISTINCT FROM 'uncategorized_income'
    AND (
        SELECT
            count(*)
        FROM
            ledger_posting q
            JOIN ledger_account b ON b.id = q.account_id
        WHERE
            q.transaction_id = t.id
            AND b.account_class IN ('income', 'expense')
    ) = 1
ORDER BY
    t.payee_id,
    a.account_class,
    t.date DESC,
    t.id DESC;

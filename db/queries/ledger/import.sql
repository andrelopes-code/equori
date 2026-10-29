-- name: GetTransactionIDByExternalRecord :one
SELECT
    transaction_id
FROM
    ledger_posting
WHERE
    user_id = $1
    AND external_record_id = $2;

-- name: ListUnlinkedPostings :many
-- The first unlinked posting of each non-voided transaction on the account in the window:
-- what statement lines may confirm (I07, P5b amendment A27).
SELECT
    u.transaction_id,
    u.booked_on,
    u.amount,
    t.payee_id,
    t.description
FROM
    (
        SELECT DISTINCT
            ON (p.transaction_id) p.transaction_id,
            p.booked_on,
            p.amount
        FROM
            ledger_posting p
        WHERE
            p.user_id = @user_id
            AND p.account_id = @account_id
            AND NOT p.voided
            AND p.external_record_id IS NULL
            AND p.booked_on BETWEEN @from_date::date AND @to_date::date
        ORDER BY
            p.transaction_id,
            p.position
    ) u
    JOIN ledger_transaction t ON t.user_id = @user_id
    AND t.id = u.transaction_id
ORDER BY
    u.booked_on,
    u.transaction_id;

-- name: ListUnconfirmedPostings :many
-- A133: the first posting of each non-voided transaction on the account that neither a line
-- links nor a balance reconciled, by the date the institution reports its line: a card
-- posting at its statement's closing. On one statement, postings of one purchase and of its
-- reversals (cancellation_of, anticipation_of) with opposite amounts offset one with one (A135).
WITH
    open AS (
        SELECT
            p.id,
            p.transaction_id,
            p.amount,
            p.statement_id,
            p.position,
            p.status,
            coalesce(s.closing_date, p.settled_on, p.booked_on)::date AS expected_on
        FROM
            ledger_posting p
            LEFT JOIN ledger_statement s ON s.user_id = p.user_id
            AND s.id = p.statement_id
        WHERE
            p.user_id = @user_id
            AND p.account_id = @account_id
            AND NOT p.voided
            AND p.external_record_id IS NULL
    ),
    ranked AS (
        SELECT
            o.id,
            o.statement_id,
            abs(o.amount) AS size,
            sign(o.amount) AS sign,
            g.origin,
            row_number() OVER (
                PARTITION BY
                    g.origin,
                    o.statement_id,
                    abs(o.amount),
                    sign(o.amount)
                ORDER BY
                    o.id
            ) AS rank
        FROM
            open o
            CROSS JOIN LATERAL (
                SELECT DISTINCT
                    l.to_transaction_id AS origin
                FROM
                    ledger_link l
                WHERE
                    l.user_id = @user_id
                    AND l.link_type IN ('cancellation_of', 'anticipation_of')
                    AND o.transaction_id IN (l.from_transaction_id, l.to_transaction_id)
            ) g
        WHERE
            o.statement_id IS NOT NULL
    ),
    offset_posting AS (
        SELECT
            r.id
        FROM
            ranked r
            JOIN ranked q ON q.origin = r.origin
            AND q.statement_id = r.statement_id
            AND q.size = r.size
            AND q.sign = - r.sign
            AND q.rank = r.rank
    )
SELECT
    u.transaction_id,
    u.expected_on,
    u.amount,
    t.payee_id,
    t.description,
    u.statement_id
FROM
    (
        SELECT DISTINCT
            ON (o.transaction_id) o.transaction_id,
            o.expected_on,
            o.amount,
            o.statement_id
        FROM
            open o
        WHERE
            o.status <> 'reconciled'
            AND o.expected_on BETWEEN @from_date::date AND @to_date::date
            AND o.id NOT IN (
                SELECT
                    id
                FROM
                    offset_posting
            )
        ORDER BY
            o.transaction_id,
            o.expected_on,
            o.position
    ) u
    JOIN ledger_transaction t ON t.user_id = @user_id
    AND t.id = u.transaction_id
ORDER BY
    u.expected_on,
    u.transaction_id;

-- name: LinkExternalRecord :exec
UPDATE ledger_posting
SET
    external_record_id = @external_record_id
WHERE
    user_id = @user_id
    AND id = @id;

-- name: ClearPendingPostings :exec
UPDATE ledger_posting
SET
    status = 'cleared'
WHERE
    user_id = @user_id
    AND transaction_id = @transaction_id
    AND account_id = @account_id
    AND status = 'pending';

-- name: ListTransactionsByExternalRecords :many
SELECT
    external_record_id::uuid AS external_record_id,
    transaction_id
FROM
    ledger_posting
WHERE
    user_id = @user_id
    AND external_record_id = ANY (@record_ids::UUID[]);

-- name: LockAccountPostingLinks :many
-- The transaction's postings on the account, locked with the transaction, in position order.
SELECT
    p.id,
    p.external_record_id,
    (t.voided_at IS NOT NULL)::boolean AS voided
FROM
    ledger_posting p
    JOIN ledger_transaction t ON t.id = p.transaction_id
WHERE
    p.user_id = $1
    AND p.transaction_id = $2
    AND p.account_id = $3
ORDER BY
    p.position
FOR UPDATE OF
    p,
    t;

-- name: LockImportedPosting :one
-- The posting an external record confirms (P6 amendment A36).
SELECT
    id,
    account_id,
    status,
    card_role
FROM
    ledger_posting
WHERE
    user_id = @user_id
    AND external_record_id = @external_record_id
FOR UPDATE;

-- name: SettleImportedPosting :exec
-- A136: a statement the line's bill states makes the institution the posting's basis.
UPDATE ledger_posting
SET
    status = @status,
    statement_id = coalesce(sqlc.narg (statement_id), statement_id),
    statement_basis = CASE
        WHEN sqlc.narg (statement_id)::uuid IS NULL THEN statement_basis
        ELSE 'institution'
    END
WHERE
    user_id = @user_id
    AND id = @id;

-- name: ReleaseExternalRecord :exec
-- A38: the posting stays; a line with another id may confirm it again.
UPDATE ledger_posting
SET
    external_record_id = NULL
WHERE
    user_id = @user_id
    AND external_record_id = @external_record_id;

-- name: GetRecordPosting :one
SELECT
    transaction_id,
    installment_plan_id
FROM
    ledger_posting
WHERE
    user_id = $1
    AND external_record_id = $2;

-- name: CountTransactions :one
SELECT
    count(*)
FROM
    ledger_transaction
WHERE
    user_id = $1;

-- name: InsertTransaction :one
INSERT INTO
    ledger_transaction (id, user_id, date, description, payee_id, balancing_currency, origin, version)
VALUES
    (
        @id,
        @user_id,
        @date,
        @description,
        sqlc.narg (payee_id),
        @balancing_currency,
        @origin,
        @version
    )
RETURNING
    *;

-- name: UpdateTransaction :exec
UPDATE ledger_transaction
SET
    date = @date,
    description = @description,
    payee_id = sqlc.narg (payee_id),
    balancing_currency = @balancing_currency,
    origin = @origin,
    version = @version,
    updated_at = now()
WHERE
    user_id = @user_id
    AND id = @id;

-- name: VoidTransaction :exec
UPDATE ledger_transaction
SET
    voided_at = $3,
    void_reason = $4,
    updated_at = now()
WHERE
    user_id = $1
    AND id = $2;

-- name: GetTransaction :one
SELECT
    *
FROM
    ledger_transaction
WHERE
    user_id = $1
    AND id = $2;

-- name: GetTransactionForUpdate :one
SELECT
    *
FROM
    ledger_transaction
WHERE
    user_id = $1
    AND id = $2
FOR UPDATE;

-- name: InsertPostings :batchexec
-- One round trip for all postings of a transaction.
INSERT INTO
    ledger_posting (
        user_id,
        transaction_id,
        account_id,
        position,
        amount,
        weight,
        booked_on,
        settled_on,
        status,
        original_amount,
        original_instrument,
        memo,
        statement_id,
        statement_basis,
        card_role,
        installment_plan_id,
        installment_number,
        installment_count,
        external_record_id
    )
VALUES
    (
        @user_id,
        @transaction_id,
        @account_id,
        @position,
        @amount,
        @weight,
        @booked_on,
        sqlc.narg (settled_on),
        @status,
        sqlc.narg (original_amount),
        sqlc.narg (original_instrument),
        sqlc.narg (memo),
        sqlc.narg (statement_id),
        @statement_basis,
        sqlc.narg (card_role),
        sqlc.narg (installment_plan_id),
        sqlc.narg (installment_number),
        sqlc.narg (installment_count),
        sqlc.narg (external_record_id)
    );

-- name: DeletePostings :exec
DELETE FROM ledger_posting
WHERE
    transaction_id = $1;

-- name: ListPostings :many
SELECT
    p.*,
    a.instrument AS account_instrument,
    t.balancing_currency,
    s.reference_month AS statement_reference
FROM
    ledger_posting p
    JOIN ledger_account a ON a.id = p.account_id
    JOIN ledger_transaction t ON t.id = p.transaction_id
    LEFT JOIN ledger_statement s ON s.id = p.statement_id
WHERE
    p.user_id = $1
    AND p.transaction_id = ANY (@transaction_ids::UUID[])
ORDER BY
    p.transaction_id,
    p.position;

-- name: DeleteTransactionTags :exec
DELETE FROM ledger_transaction_tag
WHERE
    transaction_id = $1;

-- name: InsertTransactionTag :exec
INSERT INTO
    ledger_transaction_tag (user_id, transaction_id, tag_id)
VALUES
    ($1, $2, $3);

-- name: ListTransactionTags :many
SELECT
    tt.transaction_id,
    g.name
FROM
    ledger_transaction_tag tt
    JOIN ledger_tag g ON g.id = tt.tag_id
WHERE
    tt.user_id = $1
    AND tt.transaction_id = ANY (@transaction_ids::UUID[])
ORDER BY
    g.name;

-- name: DeleteLinksFrom :exec
DELETE FROM ledger_link
WHERE
    from_transaction_id = $1;

-- name: InsertLink :exec
INSERT INTO
    ledger_link (user_id, from_transaction_id, to_transaction_id, link_type, amount)
VALUES
    ($1, $2, $3, $4, sqlc.narg (amount));

-- name: ListLinksFrom :many
SELECT
    *
FROM
    ledger_link
WHERE
    user_id = $1
    AND from_transaction_id = ANY (@transaction_ids::UUID[])
ORDER BY
    from_transaction_id,
    link_type,
    to_transaction_id;

-- name: ListLinksTo :many
SELECT
    l.link_type,
    l.from_transaction_id,
    l.amount,
    t.balancing_currency
FROM
    ledger_link l
    JOIN ledger_transaction t ON t.id = l.from_transaction_id
WHERE
    l.user_id = $1
    AND l.to_transaction_id = $2
    AND t.voided_at IS NULL
ORDER BY
    l.link_type,
    l.from_transaction_id;

-- name: InsertVersion :exec
INSERT INTO
    ledger_transaction_version (transaction_id, version, snapshot, reason)
VALUES
    ($1, $2, $3, $4);

-- name: ListVersions :many
SELECT
    v.*
FROM
    ledger_transaction_version v
    JOIN ledger_transaction t ON t.id = v.transaction_id
WHERE
    t.user_id = $1
    AND v.transaction_id = $2
ORDER BY
    v.version;

-- name: ListTransactions :many
-- A76: the account filter covers the account and its descendants.
WITH RECURSIVE
    tree AS (
        SELECT
            a.id
        FROM
            ledger_account a
        WHERE
            a.user_id = @user_id
            AND a.id = sqlc.narg (account_id)::uuid
        UNION ALL
        SELECT
            c.id
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.user_id = @user_id
    )
SELECT
    t.*
FROM
    ledger_transaction t
WHERE
    t.user_id = @user_id
    AND (
        sqlc.narg (account_id)::uuid IS NULL
        OR EXISTS (
            SELECT
                1
            FROM
                ledger_posting p
            WHERE
                p.transaction_id = t.id
                AND p.account_id IN (
                    SELECT
                        id
                    FROM
                        tree
                )
        )
    )
    AND (
        sqlc.narg (payee_id)::uuid IS NULL
        OR t.payee_id = sqlc.narg (payee_id)::uuid
    )
    AND (
        sqlc.narg (tag)::text IS NULL
        OR EXISTS (
            SELECT
                1
            FROM
                ledger_transaction_tag tt
                JOIN ledger_tag g ON g.id = tt.tag_id
            WHERE
                tt.transaction_id = t.id
                AND g.name = sqlc.narg (tag)::text
        )
    )
    AND (
        sqlc.narg (from_date)::date IS NULL
        OR t.date >= sqlc.narg (from_date)::date
    )
    AND (
        sqlc.narg (to_date)::date IS NULL
        OR t.date <= sqlc.narg (to_date)::date
    )
    -- P5 amendment A17: every category posting is on an uncategorized system account.
    -- A voided transaction cannot be categorized, so the queue leaves it out.
    AND (
        NOT @uncategorized::boolean
        OR (
            t.voided_at IS NULL
            AND EXISTS (
                SELECT
                    1
                FROM
                    ledger_posting p
                    JOIN ledger_account a ON a.id = p.account_id
                WHERE
                    p.transaction_id = t.id
                    AND a.system_role IN ('uncategorized_expense', 'uncategorized_income')
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
        )
    )
    AND (
        sqlc.narg (q)::text IS NULL
        OR strpos(lower(t.description), lower(sqlc.narg (q)::text)) > 0
        OR EXISTS (
            SELECT
                1
            FROM
                ledger_payee y
            WHERE
                y.user_id = @user_id
                AND y.id = t.payee_id
                AND strpos(lower(y.name), lower(sqlc.narg (q)::text)) > 0
        )
        OR EXISTS (
            SELECT
                1
            FROM
                ledger_posting p
            WHERE
                p.transaction_id = t.id
                AND strpos(lower(coalesce(p.memo, '')), lower(sqlc.narg (q)::text)) > 0
        )
    )
    AND (
        sqlc.narg (after_date)::date IS NULL
        OR (t.date, t.id) < (sqlc.narg (after_date)::date, sqlc.narg (after_id)::uuid)
    )
ORDER BY
    t.date DESC,
    t.id DESC
LIMIT
    @row_limit;

-- name: DeletePostingsByID :exec
DELETE FROM ledger_posting
WHERE
    transaction_id = @transaction_id
    AND id = ANY (@ids::UUID[]);

-- name: NextPostingPosition :one
SELECT
    (coalesce(max(position), -1) + 1)::smallint
FROM
    ledger_posting
WHERE
    transaction_id = $1;

-- name: ReimbursedTotal :one
-- A117: what the non-voided transactions other than @except_from repay of the expense.
SELECT
    coalesce(sum(l.amount), 0)::bigint
FROM
    ledger_link l
    JOIN ledger_transaction t ON t.user_id = l.user_id
    AND t.id = l.from_transaction_id
WHERE
    l.user_id = @user_id
    AND l.to_transaction_id = @origin_id
    AND l.link_type = 'reimbursement_of'
    AND l.from_transaction_id <> @except_from
    AND t.voided_at IS NULL;

-- name: DeleteReimbursementLinksFrom :exec
DELETE FROM ledger_link
WHERE
    user_id = $1
    AND from_transaction_id = $2
    AND link_type = 'reimbursement_of';

-- name: ListReimbursementCandidates :many
-- A117: expenses with an amount left once the other transactions are counted, dated in the window or
-- repaid by @transaction_id; those it repays first, then the one whose remaining amount equals @amount.
SELECT
    e.id,
    (e.spent - e.held)::bigint AS remaining,
    e.allocated::bigint AS allocated
FROM
    (
        SELECT
            t.id,
            t.date,
            sum(p.amount) AS spent,
            coalesce(
                (
                    SELECT
                        sum(l.amount)
                    FROM
                        ledger_link l
                        JOIN ledger_transaction f ON f.user_id = l.user_id
                        AND f.id = l.from_transaction_id
                        AND f.voided_at IS NULL
                    WHERE
                        l.user_id = @user_id
                        AND l.to_transaction_id = t.id
                        AND l.link_type = 'reimbursement_of'
                        AND l.from_transaction_id <> @transaction_id
                ),
                0
            ) AS held,
            coalesce(
                (
                    SELECT
                        sum(l.amount)
                    FROM
                        ledger_link l
                    WHERE
                        l.user_id = @user_id
                        AND l.to_transaction_id = t.id
                        AND l.link_type = 'reimbursement_of'
                        AND l.from_transaction_id = @transaction_id
                ),
                0
            ) AS allocated
        FROM
            ledger_transaction t
            JOIN ledger_posting p ON p.user_id = t.user_id
            AND p.transaction_id = t.id
            AND p.amount > 0
            AND NOT p.voided
            JOIN ledger_account a ON a.user_id = p.user_id
            AND a.id = p.account_id
            AND a.account_class = 'expense'
            AND a.instrument = @instrument::text
        WHERE
            t.user_id = @user_id
            AND t.id <> @transaction_id
            AND t.voided_at IS NULL
        GROUP BY
            t.id,
            t.date
    ) e
WHERE
    e.spent - e.held > 0
    AND (
        e.date BETWEEN @from_date::date AND @to_date::date
        OR e.allocated > 0
    )
ORDER BY
    (e.allocated > 0) DESC,
    (e.spent - e.held = @amount::bigint) DESC,
    e.date DESC,
    e.id DESC
LIMIT
    @max_rows::int;

-- name: ListReimbursementSources :many
-- A117: inflows after an expense whose category side holds only uncategorized income and reimbursements.
SELECT
    s.id,
    (s.inflow - s.allocated)::bigint AS free
FROM
    (
        SELECT
            t.id,
            t.date,
            (- sum(p.amount))::bigint AS inflow,
            coalesce(
                (
                    SELECT
                        sum(l.amount)
                    FROM
                        ledger_link l
                    WHERE
                        l.user_id = @user_id
                        AND l.from_transaction_id = t.id
                        AND l.link_type = 'reimbursement_of'
                ),
                0
            ) AS allocated
        FROM
            ledger_transaction t
            JOIN ledger_posting p ON p.user_id = t.user_id
            AND p.transaction_id = t.id
            AND NOT p.voided
            JOIN ledger_account a ON a.user_id = p.user_id
            AND a.id = p.account_id
            AND a.account_class IN ('income', 'expense')
        WHERE
            t.user_id = @user_id
            AND t.id <> @transaction_id
            AND t.voided_at IS NULL
            AND t.date BETWEEN @from_date::date AND @to_date::date
            AND a.instrument = @instrument::text
            AND NOT EXISTS (
                SELECT
                    1
                FROM
                    ledger_link l
                WHERE
                    l.user_id = @user_id
                    AND l.from_transaction_id = t.id
                    AND l.to_transaction_id = @transaction_id
                    AND l.link_type = 'reimbursement_of'
            )
        GROUP BY
            t.id,
            t.date
        HAVING
            sum(p.amount) < 0
            AND bool_and(
                (
                    a.account_class = 'income'
                    AND a.system_role = 'uncategorized_income'
                )
                OR (
                    a.account_class = 'expense'
                    AND p.amount < 0
                )
            )
    ) s
WHERE
    s.inflow - s.allocated > 0
ORDER BY
    s.date,
    s.id
LIMIT
    @max_rows::int;

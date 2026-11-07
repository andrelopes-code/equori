-- name: BalanceBookedAt :one
WITH RECURSIVE
    tree AS (
        SELECT
            a.id
        FROM
            ledger_account a
        WHERE
            a.books_id = @books_id
            AND a.id = @account_id
        UNION ALL
        SELECT
            c.id
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.books_id = @books_id
    )
SELECT
    coalesce(sum(p.amount), 0)::bigint
FROM
    ledger_posting p
WHERE
    p.account_id IN (
        SELECT
            id
        FROM
            tree
    )
    AND NOT p.voided
    AND p.booked_on <= @on_date;

-- name: BalanceSettledAt :one
WITH RECURSIVE
    tree AS (
        SELECT
            a.id
        FROM
            ledger_account a
        WHERE
            a.books_id = @books_id
            AND a.id = @account_id
        UNION ALL
        SELECT
            c.id
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.books_id = @books_id
    )
SELECT
    coalesce(sum(p.amount), 0)::bigint
FROM
    ledger_posting p
WHERE
    p.account_id IN (
        SELECT
            id
        FROM
            tree
    )
    AND NOT p.voided
    AND coalesce(p.settled_on, p.booked_on) <= @on_date;

-- name: AccountBalancesBookedAt :many
SELECT
    a.id,
    a.instrument,
    coalesce(sum(p.amount), 0)::bigint AS total
FROM
    ledger_account a
    LEFT JOIN ledger_posting p ON p.account_id = a.id
    AND NOT p.voided
    AND p.booked_on <= @on_date
WHERE
    a.books_id = @books_id
    AND a.account_class IN ('asset', 'liability')
GROUP BY
    a.id
ORDER BY
    a.name,
    a.id;

-- name: AccountBalancesSettledAt :many
SELECT
    a.id,
    a.instrument,
    coalesce(sum(p.amount), 0)::bigint AS total
FROM
    ledger_account a
    LEFT JOIN ledger_posting p ON p.account_id = a.id
    AND NOT p.voided
    AND coalesce(p.settled_on, p.booked_on) <= @on_date
WHERE
    a.books_id = @books_id
    AND a.account_class IN ('asset', 'liability')
GROUP BY
    a.id
ORDER BY
    a.name,
    a.id;

-- name: CategoryTotal :one
-- P7 amendment A54: weights of the non-voided postings of a category subtree booked in [from, to).
WITH RECURSIVE
    tree AS (
        SELECT
            a.id
        FROM
            ledger_account a
        WHERE
            a.books_id = @books_id
            AND a.id = @account_id
        UNION ALL
        SELECT
            c.id
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.books_id = @books_id
    )
SELECT
    coalesce(sum(p.weight), 0)::bigint
FROM
    ledger_posting p
WHERE
    p.account_id IN (
        SELECT
            id
        FROM
            tree
    )
    AND NOT p.voided
    AND p.booked_on >= @from_date
    AND p.booked_on < @to_date;

-- name: CategoryMonthlyTotals :many
-- CategoryTotal grouped by month in one query (P7 final review).
WITH RECURSIVE
    tree AS (
        SELECT
            a.id
        FROM
            ledger_account a
        WHERE
            a.books_id = @books_id
            AND a.id = @account_id
        UNION ALL
        SELECT
            c.id
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.books_id = @books_id
    )
SELECT
    date_trunc('month', p.booked_on)::date AS MONTH,
    sum(p.weight)::bigint AS total
FROM
    ledger_posting p
WHERE
    p.account_id IN (
        SELECT
            id
        FROM
            tree
    )
    AND NOT p.voided
    AND p.booked_on >= @from_date
    AND p.booked_on < @to_date
GROUP BY
    1
ORDER BY
    1;

-- name: TreeInstruments :many
WITH RECURSIVE
    tree AS (
        SELECT
            a.id,
            a.instrument
        FROM
            ledger_account a
        WHERE
            a.books_id = @books_id
            AND a.id = @account_id
        UNION ALL
        SELECT
            c.id,
            c.instrument
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.books_id = @books_id
    )
SELECT DISTINCT
    instrument
FROM
    tree
ORDER BY
    instrument;

-- name: TreeBalancesByInstrument :many
-- P8 amendment A65: the balance of each instrument held in the account and its sub-accounts.
WITH RECURSIVE
    tree AS (
        SELECT
            a.id,
            a.instrument
        FROM
            ledger_account a
        WHERE
            a.books_id = @books_id
            AND a.id = @account_id
        UNION ALL
        SELECT
            c.id,
            c.instrument
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.books_id = @books_id
    )
SELECT
    tree.instrument,
    coalesce(sum(p.amount), 0)::bigint AS total
FROM
    tree
    LEFT JOIN ledger_posting p ON p.account_id = tree.id
    AND NOT p.voided
    AND CASE
        WHEN @settled::boolean THEN coalesce(p.settled_on, p.booked_on)
        ELSE p.booked_on
    END <= @on_date
GROUP BY
    tree.instrument
ORDER BY
    tree.instrument;

-- name: TreeExternalFlows :many
-- Investments design 4.3: the money that entered (positive) or left (negative) the accounts and
-- their sub-accounts, taken as one tree, in each transaction of [from, to] that also touches a
-- balance account outside it, as the negated weights of the outside postings, in the
-- transaction's balancing currency. A transfer between two roots is internal.
WITH RECURSIVE
    tree AS (
        SELECT
            a.id
        FROM
            ledger_account a
        WHERE
            a.books_id = @books_id
            AND a.id = ANY (@account_ids::UUID[])
        UNION
        SELECT
            c.id
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.books_id = @books_id
    )
SELECT
    t.date,
    t.balancing_currency,
    (- sum(o.weight))::bigint AS flow
FROM
    ledger_transaction t
    JOIN ledger_posting o ON o.transaction_id = t.id
    AND NOT o.voided
    AND o.account_id NOT IN (
        SELECT
            id
        FROM
            tree
    )
    JOIN ledger_account oa ON oa.id = o.account_id
    AND oa.account_class IN ('asset', 'liability')
WHERE
    t.books_id = @books_id
    AND t.voided_at IS NULL
    AND t.date BETWEEN @from_date AND @to_date
    AND EXISTS (
        SELECT
            1
        FROM
            ledger_posting p
        WHERE
            p.transaction_id = t.id
            AND NOT p.voided
            AND p.account_id IN (
                SELECT
                    id
                FROM
                    tree
            )
    )
GROUP BY
    t.id,
    t.date,
    t.balancing_currency
ORDER BY
    t.date,
    t.id;

-- name: TreeFirstPosting :one
-- The booked date of the earliest non-voided posting of the accounts and their sub-accounts;
-- found is false, and first_on meaningless, when there is none.
WITH RECURSIVE
    tree AS (
        SELECT
            a.id
        FROM
            ledger_account a
        WHERE
            a.books_id = @books_id
            AND a.id = ANY (@account_ids::UUID[])
        UNION
        SELECT
            c.id
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.books_id = @books_id
    )
SELECT
    coalesce(min(p.booked_on), DATE '0001-01-01')::date AS first_on,
    (count(*) > 0)::boolean AS found
FROM
    ledger_posting p
WHERE
    p.books_id = @books_id
    AND NOT p.voided
    AND p.account_id IN (
        SELECT
            id
        FROM
            tree
    );

-- name: TreeRecordedYield :many
-- Return comparison amendment A208 R19, per transaction of [from_date, to_date] that touches the
-- accounts and their sub-accounts (the tree), by kind. In the balancing currency of the
-- transaction, T is the sum of the weights of the tree postings and Y the negated sum of the
-- weights of the postings against the system Yield account and its sub-accounts. When T and Y
-- have the same sign, the credit is that sign times the smaller of |T| and |Y|, as the share
-- credit / T of the native amount of the tree; the flow is the native amount of the tree less
-- the credit. Otherwise the credit is 0 and the whole native amount of the tree is a flow. Both
-- are in the instrument of the tree accounts; postings counts the tree postings of the
-- transaction, each rounded on its own. income and expense are the weights of the other income
-- and expense postings, by account name, in the balancing currency.
WITH RECURSIVE
    tree AS (
        SELECT
            a.id
        FROM
            ledger_account a
        WHERE
            a.books_id = @books_id
            AND a.id = ANY (@account_ids::UUID[])
        UNION
        SELECT
            c.id
        FROM
            ledger_account c
            JOIN tree ON c.parent_id = tree.id
        WHERE
            c.books_id = @books_id
    ),
    yield AS (
        SELECT
            y.id
        FROM
            ledger_account y
        WHERE
            y.books_id = @books_id
            AND y.system_role = 'yield'
        UNION
        SELECT
            c.id
        FROM
            ledger_account c
            JOIN yield ON c.parent_id = yield.id
        WHERE
            c.books_id = @books_id
    ),
    touched AS (
        SELECT
            t.id,
            t.date,
            t.balancing_currency
        FROM
            ledger_transaction t
        WHERE
            t.books_id = @books_id
            AND t.voided_at IS NULL
            AND t.date BETWEEN @from_date AND @to_date
            AND EXISTS (
                SELECT
                    1
                FROM
                    ledger_posting p
                WHERE
                    p.transaction_id = t.id
                    AND NOT p.voided
                    AND p.account_id IN (
                        SELECT
                            id
                        FROM
                            tree
                    )
            )
    ),
    sums AS (
        SELECT
            x.id,
            x.date,
            coalesce(
                sum(p.weight) FILTER (
                    WHERE
                        p.account_id IN (
                            SELECT
                                id
                            FROM
                                tree
                        )
                ),
                0
            )::numeric AS tree_weight,
            coalesce(
                - sum(p.weight) FILTER (
                    WHERE
                        p.account_id IN (
                            SELECT
                                id
                            FROM
                                yield
                        )
                ),
                0
            )::numeric AS yield_weight
        FROM
            touched x
            JOIN ledger_posting p ON p.transaction_id = x.id
            AND NOT p.voided
        GROUP BY
            x.id,
            x.date
    ),
    shares AS (
        SELECT
            s.id,
            s.date,
            s.tree_weight,
            CASE
                WHEN s.tree_weight <> 0
                AND sign(s.tree_weight) = sign(s.yield_weight) THEN sign(s.tree_weight) * least(abs(s.tree_weight), abs(s.yield_weight))
                ELSE 0
            END AS credit_weight
        FROM
            sums s
    ),
    native AS (
        SELECT
            h.id,
            h.date,
            a.instrument,
            sum(p.amount)::numeric AS amount,
            count(*) AS postings,
            h.tree_weight,
            h.credit_weight
        FROM
            shares h
            JOIN ledger_posting p ON p.transaction_id = h.id
            AND NOT p.voided
            JOIN ledger_account a ON a.id = p.account_id
            AND a.books_id = @books_id
        WHERE
            p.account_id IN (
                SELECT
                    id
                FROM
                    tree
            )
        GROUP BY
            h.id,
            h.date,
            a.instrument,
            h.tree_weight,
            h.credit_weight
    ),
    split AS (
        SELECT
            n.date,
            n.instrument,
            n.postings,
            n.amount,
            CASE
                WHEN n.tree_weight = 0 THEN 0
                ELSE round(n.amount * n.credit_weight / n.tree_weight)
            END AS credit
        FROM
            native n
    )
SELECT
    'flow'::text AS kind,
    s.date,
    s.instrument AS currency,
    ''::text AS label,
    (s.amount - s.credit)::bigint AS amount,
    0::bigint AS postings
FROM
    split s
WHERE
    s.amount <> s.credit
UNION ALL
SELECT
    'credit'::text,
    s.date,
    s.instrument,
    ''::text,
    s.credit::bigint,
    s.postings
FROM
    split s
WHERE
    s.credit <> 0
UNION ALL
SELECT
    a.account_class::text,
    x.date,
    x.balancing_currency,
    a.name,
    sum(p.weight)::bigint,
    0::bigint
FROM
    touched x
    JOIN ledger_posting p ON p.transaction_id = x.id
    AND NOT p.voided
    JOIN ledger_account a ON a.id = p.account_id
    AND a.books_id = @books_id
    AND a.account_class IN ('income', 'expense')
    AND a.id NOT IN (
        SELECT
            id
        FROM
            yield
    )
GROUP BY
    x.id,
    x.date,
    x.balancing_currency,
    a.account_class,
    a.name
ORDER BY
    date,
    kind,
    label;

-- name: OwnCategoryMonthlyTotals :many
-- Budget plan amendment A129: own postings of every category of a class, by month.
SELECT
    p.account_id,
    date_trunc('month', p.booked_on)::date AS MONTH,
    sum(p.weight)::bigint AS total
FROM
    ledger_posting p
    JOIN ledger_account a ON a.id = p.account_id
    AND a.books_id = p.books_id
WHERE
    p.books_id = @books_id
    AND a.account_class = @account_class
    AND NOT p.voided
    AND p.booked_on >= @from_date
    AND p.booked_on < @to_date
GROUP BY
    1,
    2;

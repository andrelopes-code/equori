-- name: GetCategorization :one
SELECT
    *
FROM
    classification_categorization
WHERE
    user_id = $1
    AND transaction_id = $2;

-- name: UpsertCategorization :execrows
-- P5 amendment A20: a row changes only for a higher transaction version.
INSERT INTO
    classification_categorization (
        transaction_id,
        user_id,
        transaction_version,
        transaction_date,
        method,
        rule_id,
        corrected,
        match_key,
        category_id,
        voided,
        decided_at
    )
VALUES
    (
        @transaction_id,
        @user_id,
        @transaction_version,
        @transaction_date,
        sqlc.narg (method),
        sqlc.narg (rule_id),
        @corrected,
        sqlc.narg (match_key),
        sqlc.narg (category_id),
        FALSE,
        @decided_at
    )
ON CONFLICT (transaction_id) DO UPDATE
SET
    transaction_version = EXCLUDED.transaction_version,
    transaction_date = EXCLUDED.transaction_date,
    method = EXCLUDED.method,
    rule_id = EXCLUDED.rule_id,
    corrected = EXCLUDED.corrected,
    match_key = EXCLUDED.match_key,
    category_id = EXCLUDED.category_id,
    decided_at = EXCLUDED.decided_at
WHERE
    classification_categorization.transaction_version < EXCLUDED.transaction_version
    AND NOT classification_categorization.voided;

-- name: MarkCategorizationVoided :exec
-- A void is final: later events of the transaction never clear it.
INSERT INTO
    classification_categorization (
        transaction_id,
        user_id,
        transaction_version,
        transaction_date,
        voided,
        decided_at
    )
VALUES
    (
        @transaction_id,
        @user_id,
        @transaction_version,
        @transaction_date,
        TRUE,
        @decided_at
    )
ON CONFLICT (transaction_id) DO UPDATE
SET
    voided = TRUE;

-- name: DeleteCategorization :exec
DELETE FROM classification_categorization
WHERE
    user_id = @user_id
    AND transaction_id = @transaction_id
    AND transaction_version < @transaction_version
    AND NOT voided;

-- name: PendingCategorizations :many
SELECT
    transaction_id,
    transaction_date
FROM
    classification_categorization
WHERE
    user_id = @user_id
    AND method IS NULL
    AND NOT voided
    AND (
        sqlc.narg (after_date)::date IS NULL
        OR (transaction_date, transaction_id) > (sqlc.narg (after_date)::date, sqlc.narg (after_id)::uuid)
    )
ORDER BY
    transaction_date,
    transaction_id
LIMIT
    @row_limit;

-- name: CountMethods :many
SELECT
    coalesce(method, '')::text AS method,
    count(*) AS n
FROM
    classification_categorization
WHERE
    user_id = @user_id
    AND NOT voided
    AND transaction_date BETWEEN @from_date AND @to_date
GROUP BY
    method;

-- name: CategorizationsByIDs :many
-- A79: the categorizations of several transactions.
SELECT
    *
FROM
    classification_categorization
WHERE
    user_id = @user_id
    AND transaction_id = ANY (@ids::UUID[])
    AND NOT voided;

-- name: RuleUsage :many
-- A80: how many current categorizations each rule decided, and the latest.
SELECT
    rule_id::uuid AS rule_id,
    count(*)::int AS n,
    max(decided_at)::timestamptz AS last_decided_at
FROM
    classification_categorization
WHERE
    user_id = @user_id
    AND method = 'rule'
    AND NOT voided
    AND rule_id = ANY (@ids::UUID[])
GROUP BY
    rule_id;

-- name: PreviewCandidates :many
-- A81: the non-voided categorizable transactions dated in [from, to], newest first.
SELECT
    transaction_id,
    transaction_date
FROM
    classification_categorization
WHERE
    user_id = @user_id
    AND NOT voided
    AND transaction_date BETWEEN @from_date::date AND @to_date::date
    AND (
        sqlc.narg (after_date)::date IS NULL
        OR (transaction_date, transaction_id) < (sqlc.narg (after_date)::date, sqlc.narg (after_id)::uuid)
    )
ORDER BY
    transaction_date DESC,
    transaction_id DESC
LIMIT
    @row_limit;

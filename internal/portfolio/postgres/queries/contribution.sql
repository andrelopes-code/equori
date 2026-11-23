-- name: GetContributionPlan :one
SELECT
    amount,
    currency
FROM
    portfolio_contribution_plan
WHERE
    books_id = @books_id;

-- name: ListContributionClasses :many
SELECT
    id,
    position,
    name,
    target_bp
FROM
    portfolio_contribution_class
WHERE
    books_id = @books_id
ORDER BY
    position;

-- name: ListContributionMembers :many
SELECT
    m.class_id,
    m.position,
    m.account_id,
    m.instrument,
    m.target_bp
FROM
    portfolio_contribution_member AS m
    JOIN portfolio_contribution_class AS c ON c.books_id = m.books_id
    AND c.id = m.class_id
WHERE
    m.books_id = @books_id
ORDER BY
    c.position,
    m.position;

-- name: ListContributionQuestions :many
SELECT
    q.class_id,
    q.position,
    q.text,
    q.fact,
    coalesce(q.limit_value::text, '')::text AS limit_value
FROM
    portfolio_contribution_question AS q
    JOIN portfolio_contribution_class AS c ON c.books_id = q.books_id
    AND c.id = q.class_id
WHERE
    q.books_id = @books_id
ORDER BY
    c.position,
    q.position;

-- name: ListContributionAnswers :many
SELECT
    class_id,
    question_position,
    member_position,
    yes
FROM
    portfolio_contribution_answer
WHERE
    books_id = @books_id;

-- name: DeleteContributionPlan :exec
DELETE FROM portfolio_contribution_plan
WHERE
    books_id = @books_id;

-- name: InsertContributionPlan :exec
INSERT INTO
    portfolio_contribution_plan (books_id, amount, currency)
VALUES
    (@books_id, sqlc.narg (amount), sqlc.narg (currency));

-- name: InsertContributionClass :one
INSERT INTO
    portfolio_contribution_class (books_id, position, name, target_bp)
VALUES
    (@books_id, @position, @name, @target_bp)
RETURNING
    id;

-- name: InsertContributionMember :exec
INSERT INTO
    portfolio_contribution_member (books_id, class_id, position, account_id, instrument, target_bp)
VALUES
    (
        @books_id,
        @class_id,
        @position,
        sqlc.narg (account_id),
        sqlc.narg (instrument),
        sqlc.narg (target_bp)
    );

-- name: InsertContributionQuestion :exec
INSERT INTO
    portfolio_contribution_question (books_id, class_id, position, text, fact, limit_value)
VALUES
    (
        @books_id,
        @class_id,
        @position,
        @text,
        sqlc.narg ('fact'),
        nullif(@limit_value::text, '')::numeric
    );

-- name: InsertContributionAnswer :exec
INSERT INTO
    portfolio_contribution_answer (books_id, class_id, question_position, member_position, yes)
VALUES
    (@books_id, @class_id, @question_position, @member_position, @yes);

-- name: ListContributionRules :many
SELECT
    r.class_id,
    r.position,
    r.instrument_type,
    r.subtypes,
    r.quote_currency,
    r.return_kind,
    r.matures_from_year,
    r.matures_to_year,
    r.daily_liquidity,
    r.guarantee
FROM
    portfolio_contribution_rule AS r
    JOIN portfolio_contribution_class AS c ON c.books_id = r.books_id
    AND c.id = r.class_id
WHERE
    r.books_id = @books_id
ORDER BY
    c.position,
    r.position;

-- name: InsertContributionRule :exec
INSERT INTO
    portfolio_contribution_rule (
        books_id,
        class_id,
        position,
        instrument_type,
        subtypes,
        quote_currency,
        return_kind,
        matures_from_year,
        matures_to_year,
        daily_liquidity,
        guarantee
    )
VALUES
    (
        @books_id,
        @class_id,
        @position,
        sqlc.narg (instrument_type),
        sqlc.narg (subtypes),
        sqlc.narg (quote_currency),
        sqlc.narg (return_kind),
        sqlc.narg (matures_from_year),
        sqlc.narg (matures_to_year),
        sqlc.narg (daily_liquidity),
        sqlc.narg (guarantee)
    );

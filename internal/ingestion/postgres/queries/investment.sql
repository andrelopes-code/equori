-- name: UpsertExternalInvestment :one
-- A later read replaces the source columns only; the link to the ledger stays.
INSERT INTO
    ingestion_external_investment (
        books_id,
        connection_id,
        external_id,
        type,
        subtype,
        name,
        issuer,
        issuer_scheme,
        issuer_id,
        index_id,
        percent_of_index_bp,
        spread_bp,
        has_terms,
        issued_on,
        matures_on,
        quantity,
        balance,
        currency,
        balance_date
    )
VALUES
    (
        @books_id,
        @connection_id,
        @external_id,
        @type,
        @subtype,
        @name,
        @issuer,
        @issuer_scheme,
        @issuer_id,
        @index_id,
        @percent_of_index_bp,
        @spread_bp,
        @has_terms,
        sqlc.narg (issued_on),
        sqlc.narg (matures_on),
        @quantity,
        @balance,
        @currency,
        @balance_date
    )
ON CONFLICT (connection_id, external_id) DO UPDATE
SET
    type = EXCLUDED.type,
    subtype = EXCLUDED.subtype,
    name = EXCLUDED.name,
    issuer = EXCLUDED.issuer,
    issuer_scheme = EXCLUDED.issuer_scheme,
    issuer_id = EXCLUDED.issuer_id,
    index_id = EXCLUDED.index_id,
    percent_of_index_bp = EXCLUDED.percent_of_index_bp,
    spread_bp = EXCLUDED.spread_bp,
    has_terms = EXCLUDED.has_terms,
    issued_on = EXCLUDED.issued_on,
    matures_on = EXCLUDED.matures_on,
    quantity = EXCLUDED.quantity,
    balance = EXCLUDED.balance,
    currency = EXCLUDED.currency,
    balance_date = EXCLUDED.balance_date
WHERE
    ingestion_external_investment.books_id = EXCLUDED.books_id
RETURNING
    id;

-- name: InsertInvestmentMovement :exec
-- A movement already stored keeps its state and its transaction.
INSERT INTO
    ingestion_investment_movement (books_id, investment_id, external_id, kind, moved_on, quantity, amount)
VALUES
    (@books_id, @investment_id, @external_id, @kind, @moved_on, @quantity, @amount)
ON CONFLICT (investment_id, external_id) DO NOTHING;

-- name: ListConnectionInvestments :many
SELECT
    *
FROM
    ingestion_external_investment
WHERE
    books_id = @books_id
    AND connection_id = @connection_id
ORDER BY
    name,
    id;

-- name: ListInvestmentMovements :many
SELECT
    *
FROM
    ingestion_investment_movement
WHERE
    books_id = @books_id
    AND investment_id = ANY (@investment_ids::UUID[])
ORDER BY
    moved_on,
    external_id;

-- name: InvestmentMovement :one
-- The investment that holds the movement.
SELECT
    i.*
FROM
    ingestion_investment_movement m
    JOIN ingestion_external_investment i ON i.books_id = m.books_id
    AND i.id = m.investment_id
WHERE
    m.books_id = @books_id
    AND m.id = @id;

-- name: SetInvestmentMovementState :exec
UPDATE ingestion_investment_movement
SET
    state = @state,
    transaction_id = sqlc.narg (transaction_id),
    application_id = @application_id
WHERE
    books_id = @books_id
    AND id = @id;

-- name: LinkExternalInvestment :exec
UPDATE ingestion_external_investment
SET
    brokerage_id = sqlc.narg (brokerage_id),
    account_id = sqlc.narg (account_id),
    instrument = sqlc.narg (instrument)
WHERE
    books_id = @books_id
    AND id = @id;

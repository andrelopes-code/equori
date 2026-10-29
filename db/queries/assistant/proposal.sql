-- name: InsertProposal :exec
INSERT INTO
    assistant_proposal (
        id,
        user_id,
        conversation_id,
        message_id,
        tool,
        arguments,
        preview,
        basis,
        status,
        result,
        created_at,
        expires_at,
        decided_at
    )
VALUES
    (
        @id,
        @user_id,
        @conversation_id,
        sqlc.narg (message_id),
        @tool,
        @arguments,
        @preview,
        @basis,
        @status,
        sqlc.narg (result),
        @created_at,
        @expires_at,
        sqlc.narg (decided_at)
    );

-- name: ProposalByID :one
SELECT
    *
FROM
    assistant_proposal
WHERE
    user_id = @user_id
    AND id = @id;

-- name: ListProposals :many
SELECT
    *
FROM
    assistant_proposal
WHERE
    user_id = @user_id
    AND conversation_id = @conversation_id
ORDER BY
    created_at,
    id;

-- name: ClaimProposal :one
UPDATE assistant_proposal
SET
    status = 'executing'
WHERE
    user_id = @user_id
    AND id = @id
    AND status = 'pending'
    AND expires_at > @now
RETURNING
    *;

-- name: DecideProposal :exec
UPDATE assistant_proposal
SET
    status = @status,
    result = sqlc.narg (result),
    decided_at = @decided_at
WHERE
    user_id = @user_id
    AND id = @id;

-- name: RejectProposal :execrows
UPDATE assistant_proposal
SET
    status = 'rejected',
    decided_at = @now
WHERE
    user_id = @user_id
    AND id = @id
    AND status = 'pending'
    AND expires_at > @now;

-- name: AttachProposals :exec
UPDATE assistant_proposal
SET
    message_id = @message_id
WHERE
    user_id = @user_id
    AND id = ANY (@ids::UUID[]);

-- name: DiscardProposals :exec
UPDATE assistant_proposal
SET
    status = 'discarded',
    decided_at = @at
WHERE
    user_id = @user_id
    AND id = ANY (@ids::UUID[])
    AND status = 'pending';

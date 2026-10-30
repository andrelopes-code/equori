-- name: InsertProposal :exec
INSERT INTO
    assistant_proposal (
        id,
        books_id,
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
        @books_id,
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
-- HA28: a proposal belongs to the member of its conversation.
SELECT
    p.*
FROM
    assistant_proposal p
    JOIN assistant_conversation c ON c.id = p.conversation_id
    AND c.books_id = p.books_id
WHERE
    p.books_id = @books_id
    AND p.id = @id
    AND c.member_id = @member_id;

-- name: ListProposals :many
SELECT
    *
FROM
    assistant_proposal
WHERE
    books_id = @books_id
    AND conversation_id = @conversation_id
ORDER BY
    created_at,
    id;

-- name: ClaimProposal :one
UPDATE assistant_proposal p
SET
    status = 'executing'
FROM
    assistant_conversation c
WHERE
    p.books_id = @books_id
    AND p.id = @id
    AND p.status = 'pending'
    AND p.expires_at > @now
    AND c.id = p.conversation_id
    AND c.books_id = p.books_id
    AND c.member_id = @member_id
RETURNING
    p.*;

-- name: DecideProposal :exec
UPDATE assistant_proposal
SET
    status = @status,
    result = sqlc.narg (result),
    decided_at = @decided_at
WHERE
    books_id = @books_id
    AND id = @id;

-- name: RejectProposal :execrows
UPDATE assistant_proposal p
SET
    status = 'rejected',
    decided_at = @now
FROM
    assistant_conversation c
WHERE
    p.books_id = @books_id
    AND p.id = @id
    AND p.status = 'pending'
    AND p.expires_at > @now
    AND c.id = p.conversation_id
    AND c.books_id = p.books_id
    AND c.member_id = @member_id;

-- name: AttachProposals :exec
UPDATE assistant_proposal
SET
    message_id = @message_id
WHERE
    books_id = @books_id
    AND id = ANY (@ids::UUID[]);

-- name: DiscardProposals :exec
UPDATE assistant_proposal
SET
    status = 'discarded',
    decided_at = @at
WHERE
    books_id = @books_id
    AND id = ANY (@ids::UUID[])
    AND status = 'pending';

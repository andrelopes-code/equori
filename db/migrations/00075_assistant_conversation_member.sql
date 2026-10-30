-- +goose Up
-- HA28: a conversation belongs to one membership.
ALTER TABLE assistant_conversation ADD COLUMN member_id bigint;

UPDATE assistant_conversation c
SET member_id = (
    SELECT ms.member_id
    FROM identity_membership ms
    WHERE ms.books_id = c.books_id AND ms.role = 'owner'
    ORDER BY ms.member_id
    LIMIT 1
);

DELETE FROM assistant_conversation WHERE member_id IS NULL;

ALTER TABLE assistant_conversation
    ALTER COLUMN member_id SET NOT NULL,
    ADD CONSTRAINT assistant_conversation_membership_fkey FOREIGN KEY (member_id, books_id)
        REFERENCES identity_membership (member_id, books_id) ON DELETE CASCADE;

DROP INDEX assistant_conversation_recent;
CREATE INDEX assistant_conversation_recent ON assistant_conversation (books_id, member_id, updated_at DESC, id DESC);

-- +goose Down
DROP INDEX assistant_conversation_recent;
CREATE INDEX assistant_conversation_recent ON assistant_conversation (books_id, updated_at DESC, id DESC);
ALTER TABLE assistant_conversation DROP CONSTRAINT assistant_conversation_membership_fkey;
ALTER TABLE assistant_conversation DROP COLUMN member_id;

-- +goose Up
-- Assistant parity design F2, F4: a sent file belongs to the message that carried it, and holds
-- the summary the model reads in its place; a message that carries a file may have empty text.
ALTER TABLE assistant_conversation_file
    ADD COLUMN message_id uuid REFERENCES assistant_message (id) ON DELETE CASCADE,
    ADD COLUMN summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 4000),
    ADD CHECK (message_id IS NULL OR conversation_id IS NOT NULL);

CREATE INDEX assistant_conversation_file_message ON assistant_conversation_file (message_id);

ALTER TABLE assistant_message
    DROP CONSTRAINT assistant_message_check,
    ADD CONSTRAINT assistant_message_check CHECK (char_length(content) <= 16000);

-- +goose Down
ALTER TABLE assistant_message
    DROP CONSTRAINT assistant_message_check,
    ADD CONSTRAINT assistant_message_check
        CHECK (char_length(content) <= 16000 AND (role = 'assistant' OR char_length(content) >= 1));
DROP INDEX assistant_conversation_file_message;
ALTER TABLE assistant_conversation_file DROP COLUMN summary, DROP COLUMN message_id;

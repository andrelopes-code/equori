-- +goose Up
-- Web search design S2: the owner's permission for a chain target to search the web.
ALTER TABLE assistant_chain_target
    DROP CONSTRAINT assistant_chain_target_capabilities_check,
    ADD CONSTRAINT assistant_chain_target_capabilities_check
    CHECK (capabilities <@ ARRAY['tools', 'structured_output', 'image_input', 'web_search']);

-- +goose Down
UPDATE assistant_chain_target
SET capabilities = array_remove(capabilities, 'web_search')
WHERE 'web_search' = ANY (capabilities);

ALTER TABLE assistant_chain_target
    DROP CONSTRAINT assistant_chain_target_capabilities_check,
    ADD CONSTRAINT assistant_chain_target_capabilities_check
    CHECK (capabilities <@ ARRAY['tools', 'structured_output', 'image_input']);

-- +goose Up
CREATE TABLE assistant_provider (
    id         uuid        NOT NULL,
    user_id    bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    preset     text        NOT NULL CHECK (preset ~ '^[a-z0-9_]{2,40}$'),
    name       text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    base_url   text        NOT NULL CHECK (base_url ~ '^https?://'),
    sealed_key bytea,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (id, user_id),
    CONSTRAINT assistant_provider_name_key UNIQUE (user_id, name)
);

CREATE TABLE assistant_chain_target (
    user_id      bigint NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    use_id       text   NOT NULL CHECK (use_id ~ '^[a-z0-9_.]{2,40}$'),
    position     int    NOT NULL CHECK (position >= 0),
    provider_id  uuid   NOT NULL,
    model        text   NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200),
    capabilities text[] NOT NULL CHECK (capabilities <@ ARRAY['tools', 'structured_output', 'image_input']),
    PRIMARY KEY (user_id, use_id, position),
    -- The composite key keeps a target on a provider of the same user.
    FOREIGN KEY (provider_id, user_id) REFERENCES assistant_provider (id, user_id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE assistant_chain_target;
DROP TABLE assistant_provider;

-- +goose Up
-- One row per user, day, provider, model and use (ADR 019 U2); provider_id is a provider row's
-- UUID or an instance provider's name, so it is text without a foreign key.
CREATE TABLE assistant_usage (
    user_id       bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    day           date        NOT NULL,
    provider_id   text        NOT NULL CHECK (char_length(provider_id) BETWEEN 1 AND 60),
    model         text        NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200),
    use_id        text        NOT NULL CHECK (use_id ~ '^[a-z0-9_.]{2,40}$'),
    requests      integer     NOT NULL CHECK (requests >= 0),
    errors        integer     NOT NULL CHECK (errors BETWEEN 0 AND requests),
    quota_errors  integer     NOT NULL CHECK (quota_errors BETWEEN 0 AND errors),
    input_tokens  bigint      NOT NULL CHECK (input_tokens >= 0),
    output_tokens bigint      NOT NULL CHECK (output_tokens >= 0),
    cooling_until timestamptz,
    PRIMARY KEY (user_id, day, provider_id, model, use_id)
);

CREATE TABLE assistant_usage_limit (
    user_id          bigint  NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    provider_id      text    NOT NULL CHECK (char_length(provider_id) BETWEEN 1 AND 60),
    model            text    NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200),
    requests_per_day integer CHECK (requests_per_day > 0),
    tokens_per_day   bigint  CHECK (tokens_per_day > 0),
    PRIMARY KEY (user_id, provider_id, model),
    CHECK (requests_per_day IS NOT NULL OR tokens_per_day IS NOT NULL)
);

-- +goose Down
DROP TABLE assistant_usage_limit;
DROP TABLE assistant_usage;

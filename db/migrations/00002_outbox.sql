-- +goose Up
CREATE TABLE outbox_event (
    id           uuid        PRIMARY KEY DEFAULT uuidv7(),
    user_id      bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    type         text        NOT NULL,
    aggregate_id text        NOT NULL,
    payload      jsonb       NOT NULL,
    occurred_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_event_type_id_idx ON outbox_event (type, id);

CREATE TABLE outbox_delivery (
    event_id        uuid        NOT NULL REFERENCES outbox_event (id) ON DELETE CASCADE,
    consumer        text        NOT NULL,
    status          text        NOT NULL CHECK (status IN ('delivered', 'retrying', 'failed')),
    attempts        int         NOT NULL DEFAULT 0,
    next_attempt_at timestamptz,
    last_error      text,
    delivered_at    timestamptz,
    PRIMARY KEY (event_id, consumer)
);

-- +goose Down
DROP TABLE outbox_delivery;
DROP TABLE outbox_event;

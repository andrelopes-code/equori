-- +goose Up
-- P7: schedules, their effective-dated terms, pauses and occurrences (docs/domain 7.3;
-- P7 amendments A46-A52). The pause exclusion constraint compares uuids with gist.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE planning_schedule (
    id                 uuid        NOT NULL DEFAULT uuidv7(),
    user_id            bigint      NOT NULL REFERENCES identity_user (id) ON DELETE CASCADE,
    kind               text        NOT NULL CHECK (kind IN ('bill', 'income', 'subscription', 'transfer', 'savings')),
    account_id         uuid        NOT NULL,
    counterpart_id     uuid        NOT NULL,
    payee_id           uuid,
    description        text        NOT NULL CHECK (length(description) BETWEEN 1 AND 200),
    currency           text        NOT NULL DEFAULT 'BRL',
    match_tolerance_bp int         NOT NULL CHECK (match_tolerance_bp BETWEEN 0 AND 10000),
    grace_days         int         NOT NULL CHECK (grace_days BETWEEN 0 AND 31),
    ends_on            date,
    generated_until    date        NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, id),
    CHECK (account_id <> counterpart_id),
    FOREIGN KEY (user_id, account_id) REFERENCES ledger_account (user_id, id),
    FOREIGN KEY (user_id, counterpart_id) REFERENCES ledger_account (user_id, id),
    FOREIGN KEY (user_id, payee_id) REFERENCES ledger_payee (user_id, id)
);
CREATE INDEX planning_schedule_list_idx ON planning_schedule (user_id, id);

-- I08: one terms version per schedule and date; the version in force is the latest
-- effective_from not after the date.
CREATE TABLE planning_schedule_terms (
    user_id              bigint NOT NULL,
    schedule_id          uuid   NOT NULL,
    effective_from       date   NOT NULL,
    frequency            text   NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval             int    NOT NULL CHECK (interval >= 1),
    day_of_month         int    CHECK (day_of_month = -1 OR day_of_month BETWEEN 1 AND 31),
    weekday              int    CHECK (weekday BETWEEN 0 AND 6),
    ordinal              int    CHECK (ordinal = -1 OR ordinal BETWEEN 1 AND 5),
    business_day_ordinal int    CHECK (business_day_ordinal = -1 OR business_day_ordinal BETWEEN 1 AND 23),
    adjustment           text   NOT NULL CHECK (adjustment IN ('none', 'following', 'preceding', 'modified_following')),
    calendar             text   NOT NULL,
    start                date   NOT NULL,
    until                date   CHECK (until >= start),
    count                int    CHECK (count >= 1),
    amount               bigint NOT NULL CHECK (amount > 0),
    PRIMARY KEY (schedule_id, effective_from),
    FOREIGN KEY (user_id, schedule_id) REFERENCES planning_schedule (user_id, id) ON DELETE CASCADE,
    CHECK ((weekday IS NULL) = (ordinal IS NULL)),
    CHECK (num_nonnulls(day_of_month, weekday, business_day_ordinal) = CASE WHEN frequency = 'monthly' THEN 1 ELSE 0 END)
);

-- A52: a pause covers [from, to]; pauses of one schedule never overlap.
CREATE TABLE planning_schedule_pause (
    user_id     bigint    NOT NULL,
    schedule_id uuid      NOT NULL,
    period      daterange NOT NULL CHECK (NOT isempty(period)),
    FOREIGN KEY (user_id, schedule_id) REFERENCES planning_schedule (user_id, id) ON DELETE CASCADE,
    EXCLUDE USING gist (schedule_id WITH =, period WITH &&)
);

-- I07 (occurrence side): an occurrence is realized by at most one transaction and a
-- transaction realizes at most one occurrence.
CREATE TABLE planning_occurrence (
    id              uuid   NOT NULL DEFAULT uuidv7(),
    user_id         bigint NOT NULL,
    schedule_id     uuid   NOT NULL,
    sequence        int    NOT NULL CHECK (sequence >= 1),
    expected_on     date   NOT NULL,
    expected_amount bigint NOT NULL CHECK (expected_amount > 0),
    state           text   NOT NULL CHECK (state IN ('expected', 'realized', 'skipped')),
    transaction_id  uuid,
    realized_by     text   CHECK (realized_by IN ('auto', 'manual')),
    moved_from      date,
    skip_reason     text   CHECK (length(skip_reason) <= 200),
    PRIMARY KEY (id),
    UNIQUE (schedule_id, sequence),
    FOREIGN KEY (user_id, schedule_id) REFERENCES planning_schedule (user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, transaction_id) REFERENCES ledger_transaction (user_id, id),
    CHECK ((state = 'realized') = (transaction_id IS NOT NULL)),
    CHECK ((transaction_id IS NULL) = (realized_by IS NULL))
);
CREATE UNIQUE INDEX planning_occurrence_transaction_idx ON planning_occurrence (user_id, transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX planning_occurrence_expected_idx ON planning_occurrence (user_id, expected_on) WHERE state = 'expected';
CREATE INDEX planning_occurrence_range_idx ON planning_occurrence (user_id, expected_on, schedule_id, sequence);

-- +goose Down
DROP TABLE planning_occurrence;
DROP TABLE planning_schedule_pause;
DROP TABLE planning_schedule_terms;
DROP TABLE planning_schedule;

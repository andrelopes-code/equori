-- +goose Up
-- ADR 029: the person (member) and the data (books) separate; IDs of backfilled books equal the member IDs (BK4).
ALTER TABLE identity_user RENAME TO identity_member;

CREATE TABLE identity_books (
    id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    region     text        NOT NULL CHECK (region ~ '^[A-Z]{2}$'),
    time_zone  text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity_membership (
    member_id  bigint      NOT NULL REFERENCES identity_member (id) ON DELETE CASCADE,
    books_id   bigint      NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    role       text        NOT NULL CHECK (role IN ('owner', 'write', 'read')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, books_id)
);

CREATE INDEX identity_membership_books_idx ON identity_membership (books_id);

INSERT INTO identity_books (id, region, created_at) OVERRIDING SYSTEM VALUE
SELECT id, region, created_at FROM identity_member;

SELECT setval(pg_get_serial_sequence('identity_books', 'id'), COALESCE(max(id), 0) + 1, false) FROM identity_books;

INSERT INTO identity_membership (member_id, books_id, role, created_at)
SELECT id, id, 'owner', created_at FROM identity_member;

ALTER TABLE identity_member DROP COLUMN region;

ALTER TABLE identity_session RENAME COLUMN user_id TO member_id;
ALTER TABLE identity_session ADD COLUMN books_id bigint;
UPDATE identity_session SET books_id = member_id;
ALTER TABLE identity_session
    ALTER COLUMN books_id SET NOT NULL,
    ADD CONSTRAINT identity_session_membership_fkey FOREIGN KEY (member_id, books_id)
        REFERENCES identity_membership (member_id, books_id) ON DELETE CASCADE;

ALTER TABLE identity_access_token RENAME COLUMN user_id TO member_id;
ALTER TABLE identity_access_token ADD COLUMN books_id bigint;
UPDATE identity_access_token SET books_id = member_id;
ALTER TABLE identity_access_token
    ALTER COLUMN books_id SET NOT NULL,
    ADD CONSTRAINT identity_access_token_membership_fkey FOREIGN KEY (member_id, books_id)
        REFERENCES identity_membership (member_id, books_id) ON DELETE CASCADE;

-- BK5: every other direct reference to the person names the books now; the 24 constraints are on user_id.
-- +goose StatementBegin
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'f'
          AND confrelid = 'identity_member'::regclass
          AND conrelid NOT IN ('identity_session'::regclass, 'identity_access_token'::regclass, 'identity_membership'::regclass)
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES identity_books (id) ON DELETE CASCADE', c.tbl, c.conname);
    END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'f' AND confrelid = 'identity_books'::regclass AND conrelid <> 'identity_membership'::regclass
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES identity_member (id) ON DELETE CASCADE', c.tbl, c.conname);
    END LOOP;
END $$;
-- +goose StatementEnd

ALTER TABLE identity_access_token DROP CONSTRAINT identity_access_token_membership_fkey, DROP COLUMN books_id;
ALTER TABLE identity_access_token RENAME COLUMN member_id TO user_id;
ALTER TABLE identity_session DROP CONSTRAINT identity_session_membership_fkey, DROP COLUMN books_id;
ALTER TABLE identity_session RENAME COLUMN member_id TO user_id;

ALTER TABLE identity_member ADD COLUMN region text;
UPDATE identity_member m SET region = b.region FROM identity_books b WHERE b.id = m.id;
ALTER TABLE identity_member ALTER COLUMN region SET NOT NULL, ADD CHECK (region ~ '^[A-Z]{2}$');

DROP TABLE identity_membership;
DROP TABLE identity_books;
ALTER TABLE identity_member RENAME TO identity_user;

-- +goose Up
-- Versions of the income split (docs/specs/2026-11-17-income-split-versions-design.md, A240,
-- A241): a method per start month, and a bucket id that stays across versions.
CREATE TABLE planning_bucket_method (
    books_id       bigint NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    effective_from date   NOT NULL CHECK (extract(day FROM effective_from) = 1),
    PRIMARY KEY (books_id, effective_from)
);

-- A stored method becomes the first version of its book, from the month of its earliest row.
INSERT INTO planning_bucket_method (books_id, effective_from)
SELECT
    books_id,
    coalesce(
        date_trunc('month', min(uuid_extract_timestamp(id)) AT TIME ZONE 'UTC')::date,
        DATE '1970-01-01'
    )
FROM
    planning_bucket
GROUP BY
    books_id;

ALTER TABLE planning_bucket
    ADD COLUMN effective_from date,
    ADD COLUMN lineage_id uuid;

UPDATE planning_bucket b
SET
    effective_from = m.effective_from,
    lineage_id = b.id
FROM
    planning_bucket_method m
WHERE
    m.books_id = b.books_id;

DROP INDEX planning_bucket_name;
DROP INDEX planning_bucket_savings;
DROP INDEX planning_bucket_goals;

ALTER TABLE planning_bucket_category
    DROP CONSTRAINT planning_bucket_category_books_id_bucket_id_fkey,
    DROP CONSTRAINT planning_bucket_category_pkey,
    ADD COLUMN effective_from date;

UPDATE planning_bucket_category c
SET
    effective_from = b.effective_from
FROM
    planning_bucket b
WHERE
    b.books_id = c.books_id
    AND b.id = c.bucket_id;

ALTER TABLE planning_bucket
    ALTER COLUMN effective_from SET NOT NULL,
    ALTER COLUMN lineage_id SET NOT NULL,
    DROP CONSTRAINT planning_bucket_books_id_position_key,
    DROP CONSTRAINT planning_bucket_books_id_id_key,
    ADD CONSTRAINT planning_bucket_method_fkey FOREIGN KEY (books_id, effective_from)
        REFERENCES planning_bucket_method (books_id, effective_from) ON DELETE CASCADE,
    ADD CONSTRAINT planning_bucket_position_key UNIQUE (books_id, effective_from, position),
    ADD CONSTRAINT planning_bucket_lineage_key UNIQUE (books_id, effective_from, lineage_id),
    ADD CONSTRAINT planning_bucket_version_id_key UNIQUE (books_id, effective_from, id);

CREATE UNIQUE INDEX planning_bucket_name
    ON planning_bucket (books_id, effective_from, lower(name));
CREATE UNIQUE INDEX planning_bucket_savings
    ON planning_bucket (books_id, effective_from) WHERE takes_savings;
CREATE UNIQUE INDEX planning_bucket_goals
    ON planning_bucket (books_id, effective_from) WHERE takes_goals;

ALTER TABLE planning_bucket_category
    ALTER COLUMN effective_from SET NOT NULL,
    ADD PRIMARY KEY (books_id, effective_from, category_id),
    ADD CONSTRAINT planning_bucket_category_bucket_fkey
        FOREIGN KEY (books_id, effective_from, bucket_id)
        REFERENCES planning_bucket (books_id, effective_from, id) ON DELETE CASCADE;

-- +goose Down
-- One method per book again: the version with the latest start stays.
DELETE FROM planning_bucket_method m
WHERE
    m.effective_from < (
        SELECT
            max(l.effective_from)
        FROM
            planning_bucket_method l
        WHERE
            l.books_id = m.books_id
    );

ALTER TABLE planning_bucket_category
    DROP CONSTRAINT planning_bucket_category_bucket_fkey,
    DROP CONSTRAINT planning_bucket_category_pkey,
    DROP COLUMN effective_from,
    ADD PRIMARY KEY (books_id, category_id);

DROP INDEX planning_bucket_name;
DROP INDEX planning_bucket_savings;
DROP INDEX planning_bucket_goals;

ALTER TABLE planning_bucket
    DROP CONSTRAINT planning_bucket_method_fkey,
    DROP CONSTRAINT planning_bucket_position_key,
    DROP CONSTRAINT planning_bucket_lineage_key,
    DROP CONSTRAINT planning_bucket_version_id_key,
    DROP COLUMN effective_from,
    DROP COLUMN lineage_id,
    ADD CONSTRAINT planning_bucket_books_id_position_key UNIQUE (books_id, position),
    ADD CONSTRAINT planning_bucket_books_id_id_key UNIQUE (books_id, id);

CREATE UNIQUE INDEX planning_bucket_name ON planning_bucket (books_id, lower(name));
CREATE UNIQUE INDEX planning_bucket_savings ON planning_bucket (books_id) WHERE takes_savings;
CREATE UNIQUE INDEX planning_bucket_goals ON planning_bucket (books_id) WHERE takes_goals;

ALTER TABLE planning_bucket_category
    ADD CONSTRAINT planning_bucket_category_books_id_bucket_id_fkey
        FOREIGN KEY (books_id, bucket_id)
        REFERENCES planning_bucket (books_id, id) ON DELETE CASCADE;

DROP TABLE planning_bucket_method;

-- +goose Up
-- Spreadsheets design SS3: a document is one spreadsheet of a book. content is the workbook
-- snapshot the editor writes; the server stores it without reading it. version counts the
-- writes of content and guards a save against a later one (SS5).
CREATE TABLE spreadsheet_document (
    id         uuid        NOT NULL DEFAULT uuidv7(),
    books_id   bigint      NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    name       text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    content    jsonb       NOT NULL CHECK (jsonb_typeof(content) = 'object'),
    version    integer     NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE INDEX spreadsheet_document_books ON spreadsheet_document (books_id, updated_at DESC);

-- +goose Down
DROP TABLE spreadsheet_document;

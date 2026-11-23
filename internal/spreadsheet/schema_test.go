package spreadsheet_test

import (
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestSchemaInvariants(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	books := h.OwnerID()

	insert := func(booksID any, name, content string, version int) error {
		_, err := h.Pool.Exec(
			t.Context(),
			`INSERT INTO spreadsheet_document (books_id, name, content, version)
			VALUES ($1, $2, $3::jsonb, $4)`,
			booksID, name, content, version,
		)

		return err
	}

	if err := insert(books, "ok", `{}`, 1); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		booksID any
		doc     string
		content string
		version int
	}{
		{"no book", nil, "a", `{}`, 1},
		{"unknown book", int64(1) << 40, "a", `{}`, 1},
		{"empty name", books, "", `{}`, 1},
		{"long name", books, strings.Repeat("a", 121), `{}`, 1},
		{"content is an array", books, "a", `[]`, 1},
		{"content is a string", books, "a", `"x"`, 1},
		{"version zero", books, "a", `{}`, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := insert(tt.booksID, tt.doc, tt.content, tt.version); err == nil {
				t.Fatal("the row was accepted")
			}
		})
	}
}

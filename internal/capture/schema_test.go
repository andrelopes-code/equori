package capture_test

import (
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// ADR 014 L4: capture_category_hint refuses what the module never writes.
func TestSchemaInvariants(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	food := h.Account("Food", "expense", "", nil)
	h.Login("other@example.com")
	uid := h.OwnerID()

	hint := func(booksID int64, class, description string, category any) error {
		_, err := h.Pool.Exec(t.Context(), `INSERT INTO capture_category_hint (books_id, class, description, category_id, answered_at)
			VALUES ($1, $2, $3, $4, now())`, booksID, class, description, category)

		return err
	}
	if err := hint(uid, "expense", "padaria", food); err != nil {
		t.Fatal(err)
	}

	otherID := h.BooksIDOf("other@example.com")

	for _, c := range []struct {
		name string
		err  error
	}{
		{"class outside expense and income", hint(uid, "transfer", "x", nil)},
		{"empty description", hint(uid, "expense", "", nil)},
		{"description over 500 characters", hint(uid, "expense", strings.Repeat("a", 501), nil)},
		{"second answer for one description", hint(uid, "expense", "padaria", nil)},
		{"category of another book", hint(otherID, "expense", "padaria", food)},
	} {
		if c.err == nil {
			t.Errorf("%s: accepted", c.name)
		}
	}
}

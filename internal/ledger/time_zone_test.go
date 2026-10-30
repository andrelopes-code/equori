package ledger_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// TestS188TodayInBooksTimeZone: the date of a request is today in the location of the book.
func TestS188TodayInBooksTimeZone(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Clock(func() time.Time {
		return time.Date(2026, 10, 30, 20, 0, 0, 0, time.UTC)
	}))
	tokyo := h.Login("tokyo@example.com")

	_, err := h.Pool.Exec(t.Context(), `UPDATE identity_books SET time_zone = 'Asia/Tokyo' WHERE id = $1`,
		h.BooksIDOf("tokyo@example.com"))
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name       string
		client     *http.Client
		wantStatus int
	}{
		{name: "region BR without time zone, today 2026-10-30", client: h.Client, wantStatus: http.StatusUnprocessableEntity},
		{name: "Asia/Tokyo, today 2026-10-31", client: tokyo, wantStatus: http.StatusCreated},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			account := h.Call(tt.client, http.MethodPost, "/api/v1/accounts", map[string]any{
				"name": "Checking", "class": "asset", "kind": "checking", "currency": "BRL",
			})
			if account.Status != http.StatusCreated {
				t.Fatalf("create account status = %d, want 201", account.Status)
			}

			var created struct {
				ID string `json:"id"`
			}
			account.Decode(t, &created)

			r := h.Call(tt.client, http.MethodPost, "/api/v1/accounts/"+created.ID+"/balance-assertions",
				map[string]any{"date": "2026-10-31", "amount": apitest.BRL(0)})
			if r.Status != tt.wantStatus {
				t.Fatalf("status = %d, want %d", r.Status, tt.wantStatus)
			}

			if tt.wantStatus == http.StatusUnprocessableEntity {
				h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "date")
			}
		})
	}
}

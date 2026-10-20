package ledger_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// CategoryTotal sums the non-voided postings of a category subtree booked in [from, to)
// (P7 amendment A54).
func TestCategoryTotal(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	market := h.Account("Supermarket", "expense", "", map[string]any{"parent_id": food})
	bakery := h.Account("Bakery", "expense", "", map[string]any{"parent_id": market})
	other := h.Account("Transport", "expense", "", nil)
	h.Record("2026-10-01", apitest.Posting(checking, -10000), apitest.Posting(food, 10000))
	h.Record("2026-10-15", apitest.Posting(checking, -2000), apitest.Posting(market, 2000))
	h.Record("2026-10-31", apitest.Posting(checking, -300), apitest.Posting(bakery, 300))
	h.Record("2026-10-20", apitest.Posting(checking, -5000), apitest.Posting(other, 5000))
	h.Record("2026-11-01", apitest.Posting(checking, -700), apitest.Posting(market, 700))
	voided := h.Record("2026-10-10", apitest.Posting(checking, -900), apitest.Posting(market, 900))
	h.MustDo(http.MethodPost, "/api/v1/transactions/"+voided+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)

	from, to := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	tests := []struct {
		name     string
		category string
		want     int64
	}{
		{"parent with a grandchild", food, 12300},
		{"child", market, 2300},
		{"leaf", bakery, 300},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := h.App.Ledger.CategoryTotal(t.Context(), h.OwnerID(), uuid.MustParse(tt.category), from, to)
			if err != nil {
				t.Fatal(err)
			}
			if got.Amount() != tt.want || got.Currency() != "BRL" {
				t.Errorf("CategoryTotal = %v, want %d BRL", got, tt.want)
			}
		})
	}
}

// CategoryMonthlyTotals groups the same sums by month in one query (P7 final review).
func TestCategoryMonthlyTotals(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	market := h.Account("Supermarket", "expense", "", map[string]any{"parent_id": food})
	h.Record("2026-09-30", apitest.Posting(checking, -100), apitest.Posting(market, 100))
	h.Record("2026-10-01", apitest.Posting(checking, -2000), apitest.Posting(food, 2000))
	h.Record("2026-10-31", apitest.Posting(checking, -300), apitest.Posting(market, 300))
	h.Record("2026-12-15", apitest.Posting(checking, -700), apitest.Posting(market, 700))
	got, err := h.App.Ledger.CategoryMonthlyTotals(t.Context(), h.OwnerID(), uuid.MustParse(food),
		time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	oct, dec := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)
	if len(got) != 2 || got[oct].Amount() != 2300 || got[dec].Amount() != 700 {
		t.Fatalf("CategoryMonthlyTotals = %v", got)
	}
}

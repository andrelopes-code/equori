package ledger_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestListBalances(t *testing.T) {
	h := apitest.New(t)
	checking := h.Account("Checking", "asset", "checking", nil)
	savings := h.Account("Savings", "asset", "savings", nil)
	card := h.Card("Visa", 5, 12, "closing")
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-10", apitest.Posting(checking, -12000), apitest.Posting(food, 12000))
	savingsIn := apitest.Posting(savings, 50000)
	savingsIn["settled_on"] = "2026-10-20"
	h.Record("2026-10-11", savingsIn, apitest.Posting(checking, -50000))

	type item struct {
		AccountID string `json:"account_id"`
		Date      string `json:"date"`
		Basis     string `json:"basis"`
		Balance   struct {
			Amount   int64  `json:"amount"`
			Currency string `json:"currency"`
		} `json:"balance"`
	}
	list := func(query string) []item {
		t.Helper()
		r := h.Call(h.Client, http.MethodGet, "/api/v1/balances"+query, nil)
		if r.Status != http.StatusOK {
			t.Fatalf("GET balances%s = %d: %s", query, r.Status, r.Body)
		}
		var out struct {
			Items []item `json:"items"`
		}
		r.Decode(t, &out)
		return out.Items
	}

	tests := []struct {
		name  string
		query string
		basis string
		date  string
		want  []int64
	}{
		{"booked", "?date=2026-10-15", "booked", "2026-10-15", []int64{-62000, 50000, 0}},
		{"settled", "?date=2026-10-15&basis=settled", "settled", "2026-10-15", []int64{-62000, 0, 0}},
		{"explicit booked", "?date=2026-10-15&basis=booked", "booked", "2026-10-15", []int64{-62000, 50000, 0}},
		{"settled after settlement date", "?date=2026-10-20&basis=settled", "settled", "2026-10-20", []int64{-62000, 50000, 0}},
		{"before any posting", "?date=2026-10-01", "booked", "2026-10-01", []int64{0, 0, 0}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			items := list(tt.query)
			// Ordered by account name: Checking, Savings, Visa. Food is an expense and has no item.
			wantIDs := []string{checking, savings, card}
			ids := make([]string, len(items))
			got := make([]int64, len(items))
			for i, it := range items {
				ids[i], got[i] = it.AccountID, it.Balance.Amount
				if it.Basis != tt.basis || it.Date != tt.date || it.Balance.Currency != "BRL" {
					t.Errorf("item %d = basis %q date %q currency %q, want %q %q BRL", i, it.Basis, it.Date, it.Balance.Currency, tt.basis, tt.date)
				}
			}
			if !slices.Equal(ids, wantIDs) {
				t.Fatalf("account ids = %v, want %v", ids, wantIDs)
			}
			if !slices.Equal(got, tt.want) {
				t.Errorf("amounts = %v, want %v", got, tt.want)
			}
		})
	}

	t.Run("other user", func(t *testing.T) {
		other := h.Login("other@example.com")
		r := h.Call(other, http.MethodGet, "/api/v1/balances?date=2026-10-15", nil)
		if r.Status != http.StatusOK {
			t.Fatalf("status = %d: %s", r.Status, r.Body)
		}
		var out struct {
			Items []item `json:"items"`
		}
		r.Decode(t, &out)
		if out.Items == nil || len(out.Items) != 0 {
			t.Errorf("items = %+v, want empty array", out.Items)
		}
	})

	t.Run("missing date", func(t *testing.T) {
		h.ExpectProblem(h.Call(h.Client, http.MethodGet, "/api/v1/balances", nil), http.StatusBadRequest, "invalid_request", "date")
	})

	t.Run("unknown basis", func(t *testing.T) {
		h.ExpectProblem(h.Call(h.Client, http.MethodGet, "/api/v1/balances?date=2026-10-15&basis=x", nil), http.StatusBadRequest, "invalid_request", "basis")
	})
}

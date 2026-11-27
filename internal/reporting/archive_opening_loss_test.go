package reporting_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S766 (investment history EX1): an opening and an opening loss leave the archive and come back
// as they were.
func TestS766ArchiveKeepsHistory(t *testing.T) {
	t.Parallel()
	source := apitest.New(t, apitest.Today("2026-10-26"))
	source.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code":           "PETR4",
		"type":           "stock",
		"scale":          0,
		"name":           "PETR4",
		"quote_currency": "BRL",
		"exchange":       "BVMF",
	}, http.StatusCreated, nil)
	xp := source.Account("XP", "asset", "brokerage", map[string]any{"opened_on": "2026-10-01"})
	source.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"brokerage_id": xp,
		"instrument":   "PETR4",
		"side":         "opening",
		"date":         "2021-03-10",
		"quantity":     map[string]any{"amount": 100, "currency": "PETR4"},
		"unit_price":   "20.00",
		"fees":         apitest.BRL(500),
	}, http.StatusCreated, nil)
	source.MustDo(http.MethodPut, "/api/v1/gain-tax/opening-losses", map[string]any{
		"losses": []map[string]any{{
			"pool":   "ordinary",
			"month":  "2026-01",
			"amount": apitest.BRL(100000),
		}},
	}, http.StatusOK, nil)

	target := apitest.New(t, apitest.Today("2026-10-26"))

	if r := target.Upload(importPath, "a.zip", export(t, source)); r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	held := target.Rows(
		`SELECT coalesce(sum(p.amount), 0)::text || ' ' || coalesce(sum(p.weight), 0)::text
		FROM ledger_posting p
		WHERE p.account_id IN (SELECT account_id FROM ledger_trade)`,
	)
	if len(held) != 1 || held[0] != "100 200500" {
		t.Errorf("holding = %v, want 100 units at the cost 200500", held)
	}

	sides := target.Rows(`SELECT side FROM ledger_trade`)
	if len(sides) != 1 || sides[0] != "opening" {
		t.Errorf("trade sides = %v, want [opening]", sides)
	}

	var got struct {
		Losses []struct {
			Pool   string `json:"pool"`
			Month  string `json:"month"`
			Amount struct {
				Amount int64 `json:"amount"`
			} `json:"amount"`
		} `json:"losses"`
	}
	target.MustDo(http.MethodGet, "/api/v1/gain-tax/opening-losses", nil, http.StatusOK, &got)

	if len(got.Losses) != 1 || got.Losses[0].Pool != "ordinary" ||
		got.Losses[0].Month != "2026-01" || got.Losses[0].Amount.Amount != 100000 {
		t.Errorf("opening losses = %+v, want ordinary 2026-01 1000.00", got.Losses)
	}
}

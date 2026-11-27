package portfolio_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const openingLossPath = "/api/v1/gain-tax/opening-losses"

type openingLossSet struct {
	Pools  []string `json:"pools"`
	Losses []struct {
		Pool   string `json:"pool"`
		Month  string `json:"month"`
		Amount struct {
			Amount   int64  `json:"amount"`
			Currency string `json:"currency"`
		} `json:"amount"`
	} `json:"losses"`
}

func openingLossBody(pool, month string, amount int64, currency string) map[string]any {
	return map[string]any{"losses": []map[string]any{{
		"pool": pool, "month": month,
		"amount": map[string]any{"amount": amount, "currency": currency},
	}}}
}

// S764 (investment history LO1 to LO4): a loss of 1,000.00 carried into 2026-01 absorbs the gain
// of 600.00 of a sale of 2026-03 and leaves 400.00.
func TestS764OpeningLoss(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-05-01"))

	var saved openingLossSet
	f.h.MustDo(
		http.MethodPut, openingLossPath,
		openingLossBody("ordinary", "2026-01", 100000, "BRL"), http.StatusOK, &saved,
	)

	f.stockTrade(t, "buy", "2026-02-02", 1000, "29.40", 0)
	f.stockTrade(t, "sell", "2026-03-02", 1000, "30.00", 0)
	f.h.Dispatch()

	var got openingLossSet
	f.h.MustDo(http.MethodGet, openingLossPath, nil, http.StatusOK, &got)

	if want := []string{"ordinary", "day_trade", "fii"}; !reflect.DeepEqual(got.Pools, want) {
		t.Errorf("pools = %v, want %v", got.Pools, want)
	}

	if len(got.Losses) != 1 || got.Losses[0].Pool != "ordinary" ||
		got.Losses[0].Month != "2026-01" || got.Losses[0].Amount.Amount != 100000 ||
		!reflect.DeepEqual(got, saved) {
		t.Errorf("losses = %+v, saved %+v", got.Losses, saved.Losses)
	}

	var tax struct {
		Items []struct {
			Month string `json:"month"`
			Lines []struct {
				Pool        string         `json:"pool"`
				LossUsed    map[string]any `json:"loss_used"`
				LossCarried map[string]any `json:"loss_carried"`
				Tax         map[string]any `json:"tax"`
			} `json:"lines"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/gain-tax?year=2026", nil, http.StatusOK, &tax)

	if len(tax.Items) != 1 || tax.Items[0].Month != "2026-03" || len(tax.Items[0].Lines) != 1 {
		t.Fatalf("gain tax = %+v", tax)
	}

	l := tax.Items[0].Lines[0]
	if l.Pool != "ordinary" || l.LossUsed["amount"] != float64(60000) ||
		l.LossCarried["amount"] != float64(40000) || l.Tax["amount"] != float64(0) {
		t.Errorf("line = %+v, want used 600.00 carried 400.00 tax 0.00", l)
	}
}

// S765 (LO2, LO4, AS4, B2): the pool crypto, a region without a jurisdiction, a reader and
// another book.
func TestS765OpeningLossAccess(t *testing.T) {
	t.Parallel()
	f := newFixture(t, apitest.Today("2026-05-01"))

	invalid := map[string]struct {
		body  map[string]any
		field string
	}{
		"pool crypto": {openingLossBody("crypto", "2026-01", 100000, "BRL"), "losses[0].pool"},
		"amount zero": {openingLossBody("ordinary", "2026-01", 0, "BRL"), "losses[0].amount"},
		"currency":    {openingLossBody("ordinary", "2026-01", 1, "USD"), "losses[0].amount"},
		"pool twice": {map[string]any{"losses": []map[string]any{
			openingLossBody("fii", "2026-01", 1, "BRL")["losses"].([]map[string]any)[0],
			openingLossBody("fii", "2026-02", 2, "BRL")["losses"].([]map[string]any)[0],
		}}, "losses[1].pool"},
	}
	for name, tc := range invalid {
		t.Run(name, func(t *testing.T) {
			f.h.ExpectProblem(
				f.h.Do(http.MethodPut, openingLossPath, tc.body),
				http.StatusUnprocessableEntity, "validation_failed", tc.field,
			)
		})
	}

	f.h.MustDo(
		http.MethodPut, openingLossPath,
		openingLossBody("fii", "2026-01", 5000, "BRL"), http.StatusOK, nil,
	)

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	f.h.ExpectProblem(
		f.h.Call(
			reader,
			http.MethodPut,
			openingLossPath,
			openingLossBody("fii", "2026-01", 1, "BRL"),
		),
		http.StatusForbidden,
		"book_role_required",
		"",
	)

	var read openingLossSet
	if r := f.h.Call(reader, http.MethodGet, openingLossPath, nil); r.Status != http.StatusOK {
		t.Fatalf("reader GET = %d: %s", r.Status, r.Body)
	} else {
		r.Decode(t, &read)
	}

	if len(read.Losses) != 1 {
		t.Errorf("reader losses = %+v, want the one saved", read.Losses)
	}

	var other openingLossSet
	f.h.Call(f.h.Login("other@example.com"), http.MethodGet, openingLossPath, nil).Decode(t, &other)

	if len(other.Losses) != 0 {
		t.Errorf("another book's losses = %+v, want none", other.Losses)
	}

	var cleared openingLossSet
	f.h.MustDo(
		http.MethodPut, openingLossPath, map[string]any{"losses": []any{}}, http.StatusOK, &cleared,
	)

	if len(cleared.Losses) != 0 {
		t.Errorf("losses after an empty list = %+v", cleared.Losses)
	}
}

// S765 (LO2, R2): a region without a jurisdiction lists no pool and accepts no loss.
func TestS765OpeningLossNeutral(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.As(apitest.Neutral()))

	h.ExpectProblem(
		h.Do(http.MethodPut, openingLossPath, openingLossBody("ordinary", "2026-01", 100, "NZD")),
		http.StatusUnprocessableEntity, "validation_failed", "losses[0].pool",
	)

	var got openingLossSet
	h.MustDo(http.MethodGet, openingLossPath, nil, http.StatusOK, &got)

	if len(got.Pools) != 0 || len(got.Losses) != 0 {
		t.Errorf("set = %+v, want none", got)
	}
}

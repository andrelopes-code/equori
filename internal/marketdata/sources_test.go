package marketdata_test

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestNewSources(t *testing.T) {
	t.Parallel()

	f := &feedServer{}
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	hc := srv.Client()

	if _, err := marketdata.NewSources(
		[]string{"nope"},
		nil,
		hc,
		at("2026-12-01T00:00:00Z"),
	); err == nil ||
		err.Error() != `unknown price feed "nope"` {
		t.Fatalf("err = %v", err)
	}

	got, err := marketdata.NewSources(
		[]string{"bcb_ptax"},
		map[string]string{"bcb_ptax": srv.URL + "/ptax"},
		hc,
		at("2026-12-01T00:00:00Z"),
	)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 1 || got[0].ID() != "bcb_ptax" {
		t.Fatalf("sources = %v", got)
	}

	day := time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)

	quotes, err := got[0].Fetch(t.Context(), []money.Currency{"USD"}, day, day)
	if err != nil || len(quotes) != 2 {
		t.Fatalf("quotes = %v, err = %v", quotes, err)
	}

	reqs := f.take()
	if len(reqs) != 1 || !strings.HasPrefix(reqs[0], "/ptax/") {
		t.Fatalf("requests = %v", reqs)
	}
}

func TestSourceIDs(t *testing.T) {
	t.Parallel()

	if got := strings.Join(
		marketdata.SourceIDs(),
		",",
	); got != "b3_cotahist,b3_consolidated,b3_price_report,bcb_ptax,ecb,tesouro_direto,cvm_funds,coinbase,yahoo_chart" {
		t.Fatalf("ids = %s", got)
	}
}

func at(s string) func() time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}

	return func() time.Time { return t }
}

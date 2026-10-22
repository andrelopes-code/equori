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

	if _, err := marketdata.NewSources([]string{"nope"}, nil, hc); err == nil || err.Error() != `EQUORI_PRICE_FEEDS: unknown feed "nope"` {
		t.Fatalf("err = %v", err)
	}

	got, err := marketdata.NewSources([]string{"bcb_ptax"}, map[string]string{"bcb_ptax": srv.URL + "/ptax"}, hc)
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
	if got := strings.Join(marketdata.SourceIDs(), ","); got != "b3_cotahist,bcb_ptax,ecb" {
		t.Fatalf("ids = %s", got)
	}
}

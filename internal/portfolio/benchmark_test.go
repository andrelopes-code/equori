package portfolio_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// cdiDays are the six CDI business days of 2026-01-02 to 2026-01-09, at 0.055131 percent a day.
var cdiDays = []string{"2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"}

type comparedReturn struct {
	PeriodBP  *int `json:"period_bp"`
	Benchmark *struct {
		Index     string `json:"index"`
		Until     string `json:"until"`
		ReturnBP  *int   `json:"return_bp"`
		IndexBP   int    `json:"index_bp"`
		PercentBP *int   `json:"percent_bp"`
	} `json:"benchmark"`
}

// S302: a savings account paid the CDI of each day on its balance earns 100% of CDI.
func TestS302SavingsAtTheCDI(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)

	r := b.compared(t, "2026-01-02", "2026-01-09", "")
	if r.PeriodBP == nil || *r.PeriodBP != 33 || r.Benchmark == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.Index != "cdi" || got.Until != "2026-01-09" || got.IndexBP != 33 || got.ReturnBP == nil || *got.ReturnBP != 33 || got.PercentBP == nil || *got.PercentBP != 10000 {
		t.Fatalf("benchmark = %+v", got)
	}
}

// S303: a deposit inside the period leaves the percent of the CDI unchanged, and the window ends
// at the last stored rate.
func TestS303DepositInsideThePeriod(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t, "2026-01-06")

	r := b.compared(t, "2026-01-02", "2026-01-12", "")
	if r.PeriodBP == nil || *r.PeriodBP != 33 || r.Benchmark == nil {
		t.Fatalf("report = %+v", r)
	}

	got := *r.Benchmark
	if got.Until != "2026-01-09" || got.PercentBP == nil || *got.PercentBP != 10000 {
		t.Fatalf("benchmark = %+v", got)
	}
}

// S304: a monthly index and an index without an enabled source are refused on index.
func TestS304IndexRefused(t *testing.T) {
	t.Parallel()
	b := newBenchmarkBook(t)

	for _, index := range []string{"ipca", "sofr"} {
		r := b.h.Do(http.MethodGet, b.query("2026-01-02", "2026-01-09", index), nil)
		if r.Status != http.StatusBadRequest || !strings.Contains(string(r.Body), `"field":"index"`) {
			t.Fatalf("index %s: status %d: %s", index, r.Status, r.Body)
		}
	}
}

type benchmarkBook struct {
	h       *apitest.Harness
	savings string
}

// newBenchmarkBook holds 10,000,000.00 in a savings account from 2026-01-01 and credits on each
// CDI day the rate of the day on the balance of the day before; each date in deposits adds
// 10,000,000.00 from checking after that day's credit.
func newBenchmarkBook(t *testing.T, deposits ...string) benchmarkBook {
	t.Helper()

	rows := make([]string, len(cdiDays))
	for i, d := range cdiDays {
		day, _ := time.Parse(time.DateOnly, d)
		rows[i] = fmt.Sprintf(`{"data":%q,"valor":"0.055131"}`, day.Format("02/01/2006"))
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/dados/serie/bcdata.sgs.12/dados":
			fmt.Fprint(w, "["+strings.Join(rows, ",")+"]")
		case "/dados/serie/bcdata.sgs.433/dados":
			fmt.Fprint(w, `[{"data":"01/12/2025","valor":"0.33"}]`)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	urls := map[string]string{"br_cdi": srv.URL, "br_ipca": srv.URL}
	h := apitest.New(t, apitest.Today("2026-01-12"), apitest.IndexFeeds([]string{"br_cdi", "br_ipca"}, urls))
	h.App.Marketdata.TickFeeds(t.Context())

	checking := h.Account("Checking", "asset", "checking", nil)
	savings := h.Account("Savings", "asset", "savings", nil)
	interest := h.Account("Interest", "income", "", nil)

	const deposit = 1_000_000_000
	h.Record("2026-01-01", apitest.Posting(checking, -deposit), apitest.Posting(savings, deposit))

	balance := int64(deposit)
	for _, d := range cdiDays {
		// 0.055131% of the balance, rounded half up to the cent.
		credit := (balance*55131 + 50_000_000) / 100_000_000
		h.Record(d, apitest.Posting(interest, -credit), apitest.Posting(savings, credit))
		balance += credit

		for _, dep := range deposits {
			if dep == d {
				h.Record(d, apitest.Posting(checking, -deposit), apitest.Posting(savings, deposit))
				balance += deposit
			}
		}
	}

	return benchmarkBook{h: h, savings: savings}
}

func (b benchmarkBook) query(from, to, index string) string {
	q := fmt.Sprintf("/api/v1/reports/return?account_id=%s&from=%s&to=%s", b.savings, from, to)
	if index != "" {
		q += "&index=" + index
	}

	return q
}

func (b benchmarkBook) compared(t *testing.T, from, to, index string) comparedReturn {
	t.Helper()
	b.h.Dispatch()

	r := b.h.Do(http.MethodGet, b.query(from, to, index), nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	var out comparedReturn
	r.Decode(t, &out)

	return out
}

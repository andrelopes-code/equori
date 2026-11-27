package ledger_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const investmentFileHeader = "kind,date,instrument,quantity,unit_price,fees,taxes," +
	"gross,withheld,income_type,exchange_rate"

type investmentFileResult struct {
	Lines   int `json:"lines"`
	Created int `json:"created"`
	Skipped int `json:"skipped"`
}

type investmentFileFixture struct {
	openingFixture
	category string
}

// S760 (investment history IF1 to IF8): a file of an opening, a purchase, a sale and an income
// is recorded in date order in one transaction; the same file again records nothing; a dry run
// counts and writes nothing.
func TestS760InvestmentFile(t *testing.T) {
	t.Parallel()
	f := newInvestmentFileFixture(t, apitest.Brazil(), "HGLG11", "reit", 1000000)
	file := investmentFile(
		"opening,2021-03-10,PETR4,100,20.00,5.00,,,,,",
		"buy,2026-11-03,HGLG11,10,160.00,1.00,,,,,",
		"sell,2026-11-10,PETR4,40,30.00,,0.06,,,,",
		"income,2026-11-14,HGLG11,,,,,11.00,,distribution,",
	)

	got := f.upload(t, file, map[string]string{"category_id": f.category})
	if want := (investmentFileResult{Lines: 4, Created: 4}); got != want {
		t.Fatalf("first import = %+v, want %+v", got, want)
	}

	f.expectCash(t, "960994")

	got = f.upload(t, file, map[string]string{"category_id": f.category})
	if want := (investmentFileResult{Lines: 4, Skipped: 4}); got != want {
		t.Fatalf("second import = %+v, want %+v", got, want)
	}

	f.expectCash(t, "960994")

	dry := investmentFile("buy,2026-11-12,HGLG11,5,150.00,,,,,,")
	got = f.upload(t, dry, map[string]string{"dry_run": "true"})

	if want := (investmentFileResult{Lines: 1, Created: 1}); got != want {
		t.Fatalf("dry run = %+v, want %+v", got, want)
	}

	f.expectCash(t, "960994")
	f.expectTrades(t, "3")
}

// S761 (IF3, IF4, IF5, IF7): a refused line records nothing; the role and the book of the
// brokerage are checked.
func TestS761RefusedFile(t *testing.T) {
	t.Parallel()
	f := newInvestmentFileFixture(t, apitest.Brazil(), "HGLG11", "reit", 1000000)

	tests := []struct {
		name   string
		file   string
		fields map[string]string
		field  string
	}{
		{
			name: "invalid date on line 3",
			file: investmentFile(
				"buy,2026-11-03,HGLG11,10,160.00,1.00,,,,,",
				"buy,2026-13-01,HGLG11,10,160.00,1.00,,,,,",
			),
			field: "line 3",
		},
		{
			name:  "wrong header",
			file:  "kind,date\nbuy,2026-11-03\n",
			field: "line 1",
		},
		{
			name:  "income without category",
			file:  investmentFile("income,2026-11-14,PETR4,,,,,11.00,,distribution,"),
			field: "category_id",
		},
		{
			name:  "unknown instrument",
			file:  investmentFile("opening,2021-03-10,ZZZZ3,100,20.00,,,,,,"),
			field: "line 2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f.h.ExpectProblem(
				f.h.UploadWith(f.path(), tt.fields, "operations.csv", []byte(tt.file)),
				http.StatusUnprocessableEntity,
				"validation_failed",
				tt.field,
			)
			f.expectCash(t, "1000000")
			f.expectTrades(t, "0")
		})
	}

	file := []byte(investmentFile("buy,2026-11-03,HGLG11,10,160.00,1.00,,,,,"))

	t.Run("reader", func(t *testing.T) {
		reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")

		r := f.h.UploadAs(reader, f.path(), nil, "operations.csv", file)
		if r.Status != http.StatusForbidden {
			t.Fatalf("status = %d: %s", r.Status, r.Body)
		}
	})

	t.Run("another book", func(t *testing.T) {
		other := f.h.Login("other@example.com")

		r := f.h.UploadAs(other, f.path(), nil, "operations.csv", file)
		if r.Status != http.StatusNotFound {
			t.Fatalf("status = %d: %s", r.Status, r.Body)
		}
	})

	f.expectCash(t, "1000000")
	f.expectTrades(t, "0")
}

// S762 (IF4, IF5): a region without a jurisdiction imports a security quoted in another
// currency; the sale after the opening of the same file closes at its cost.
func TestS762InvestmentFileNeutral(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.As(apitest.Neutral()))
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "VOO", "type": "etf", "scale": 0, "name": "VOO",
		"quote_currency": "USD", "exchange": "ARCX",
	}, http.StatusCreated, nil)

	var inst idOnly
	h.MustDo(http.MethodPost, "/api/v1/institutions",
		map[string]string{"name": "IBKR"}, http.StatusCreated, &inst)

	// The brokerage takes the quote currency of VOO; the cash is an account of its institution.
	ibkr := h.Account("IBKR", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"currency":       "USD",
		"opened_on":      "2026-11-01",
	})
	cash := h.Account("IBKR cash", "asset", "checking", map[string]any{
		"institution_id": inst.ID,
		"opened_on":      "2026-11-01",
	})
	h.Record(
		"2026-11-01",
		h.Posting(cash, 1000000),
		h.Posting(systemAccount(t, h, "opening_balances"), -1000000),
	)

	file := investmentFile(
		"opening,2024-05-02,VOO,10,500.00,,,,,,1.00",
		"sell,2026-11-10,VOO,4,600.00,,,,,,",
	)

	r := h.UploadWith("/api/v1/brokerages/"+ibkr+"/investment-file", nil, "ops.csv", []byte(file))
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	var got investmentFileResult
	r.Decode(t, &got)

	if want := (investmentFileResult{Lines: 2, Created: 2}); got != want {
		t.Fatalf("import = %+v, want %+v", got, want)
	}

	sale := h.Rows(
		`SELECT cost::text, (gross - cost)::text FROM ledger_trade WHERE side = 'sell'`,
	)
	if len(sale) != 1 || sale[0] != "200000 40000" {
		t.Fatalf("sale cost and result = %v, want [200000 40000]", sale)
	}
}

func newInvestmentFileFixture(
	t *testing.T,
	pr apitest.Profile,
	code, kind string,
	deposit int64,
) investmentFileFixture {
	t.Helper()

	f := investmentFileFixture{openingFixture: newOpeningFixture(t, pr)}
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security(code, kind),
		http.StatusCreated,
		nil,
	)
	f.h.Record(
		"2026-11-01",
		f.h.Posting(f.cash, deposit),
		f.h.Posting(systemAccount(t, f.h, "opening_balances"), -deposit),
	)
	f.category = f.h.Account("Dividends", "income", "", nil)

	return f
}

func (f investmentFileFixture) path() string {
	return "/api/v1/brokerages/" + f.xp + "/investment-file"
}

func (f investmentFileFixture) upload(
	t *testing.T,
	file string,
	fields map[string]string,
) investmentFileResult {
	t.Helper()

	r := f.h.UploadWith(f.path(), fields, "operations.csv", []byte(file))
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	var out investmentFileResult
	r.Decode(t, &out)

	return out
}

func (f investmentFileFixture) expectCash(t *testing.T, want string) {
	t.Helper()

	got := f.h.Rows(
		`SELECT coalesce(sum(amount), 0)::text FROM ledger_posting WHERE account_id = $1`,
		f.cash,
	)
	if len(got) != 1 || got[0] != want {
		t.Errorf("cash = %v, want %s", got, want)
	}
}

func (f investmentFileFixture) expectTrades(t *testing.T, want string) {
	t.Helper()

	got := f.h.Rows(`SELECT count(*)::text FROM ledger_trade`)
	if len(got) != 1 || got[0] != want {
		t.Errorf("trades = %v, want %s", got, want)
	}
}

func investmentFile(lines ...string) string {
	return investmentFileHeader + "\n" + strings.Join(lines, "\n") + "\n"
}

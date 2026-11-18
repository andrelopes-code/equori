package portfolio_test

import (
	"net/http"
	"reflect"
	"strconv"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const exposureDate = "2026-11-02"

type exposureHolding struct {
	code, subtype, issuer, scheme, id string
	value                             int64 // minor units
	noPrice                           bool
}

type exposureOut struct {
	Issuers []struct {
		Key            *string `json:"key"`
		Issuer         *string `json:"issuer"`
		MarketValue    amount  `json:"market_value"`
		CoveredValue   amount  `json:"covered_value"`
		UncoveredValue amount  `json:"uncovered_value"`
		SovereignValue amount  `json:"sovereign_value"`
		Limit          *amount `json:"limit"`
		Excess         *amount `json:"excess"`
	} `json:"issuers"`
	Guarantee *struct {
		Name           string   `json:"name"`
		LimitPerIssuer amount   `json:"limit_per_issuer"`
		LimitPerPeriod amount   `json:"limit_per_period"`
		PeriodYears    int      `json:"period_years"`
		Covered        []string `json:"covered"`
	} `json:"guarantee"`
	PeriodNote    bool     `json:"period_note"`
	MissingPrices []string `json:"missing_prices"`
}

type issuerRow struct {
	Issuer                     string
	Market, Covered, Uncovered int64
	Limit, Excess              int64
}

// newExposureBook holds each holding as one unit bought on 2026-10-01 and priced on 2026-11-02.
func newExposureBook(
	t *testing.T,
	profile apitest.Profile,
	holdings []exposureHolding,
) *apitest.Harness {
	t.Helper()

	h := apitest.New(t, apitest.Today(exposureDate), apitest.As(profile))
	currency := string(profile.Base)

	var inst struct {
		ID string `json:"id"`
	}
	h.MustDo(
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": "XP"},
		http.StatusCreated,
		&inst,
	)

	parent := h.Account("XP", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"currency":       currency,
	})
	cash := h.Account("XP cash", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID,
		"parent_id":      parent,
		"currency":       currency,
	})

	for _, hd := range holdings {
		body := map[string]any{
			"code":           hd.code,
			"type":           "fixed_income",
			"scale":          0,
			"name":           hd.code,
			"quote_currency": currency,
			"subtype":        hd.subtype,
		}
		if hd.issuer != "" {
			issuer := map[string]any{"name": hd.issuer}
			if hd.scheme != "" {
				issuer["scheme"], issuer["id"] = hd.scheme, hd.id
			}

			body["issuer"] = issuer
		}

		h.MustDo(http.MethodPost, "/api/v1/instruments", body, http.StatusCreated, nil)

		account := h.Account(hd.code, "asset", "brokerage", map[string]any{
			"institution_id": inst.ID,
			"parent_id":      parent,
			"currency":       hd.code,
		})
		price := strconv.FormatInt(hd.value/100, 10)
		h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
			"account_id":      account,
			"cash_account_id": cash,
			"side":            "buy",
			"date":            "2026-10-01",
			"quantity":        units(1, hd.code),
			"unit_price":      price,
		}, http.StatusCreated, nil)

		if !hd.noPrice {
			h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
				"instrument":       hd.code,
				"quote_instrument": currency,
				"date":             exposureDate,
				"value":            price,
			}, http.StatusCreated, nil)
		}
	}

	h.Dispatch()

	return h
}

func exposureOf(t *testing.T, h *apitest.Harness, c *http.Client) exposureOut {
	t.Helper()

	var out exposureOut

	r := h.Call(c, http.MethodGet, "/api/v1/issuer-exposure?date="+exposureDate, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &out)

	return out
}

func rowsOfExposure(e exposureOut) []issuerRow {
	rows := make([]issuerRow, len(e.Issuers))
	for i, x := range e.Issuers {
		rows[i] = issuerRow{
			Market:    x.MarketValue.Amount,
			Covered:   x.CoveredValue.Amount,
			Uncovered: x.UncoveredValue.Amount,
		}
		if x.Issuer != nil {
			rows[i].Issuer = *x.Issuer
		}

		if x.Limit != nil {
			rows[i].Limit = x.Limit.Amount
		}

		if x.Excess != nil {
			rows[i].Excess = x.Excess.Amount
		}
	}

	return rows
}

func TestS520ExposureOfOneIssuer(t *testing.T) {
	t.Parallel()
	h := newExposureBook(t, apitest.Brazil(), []exposureHolding{
		{"CDBX", "cdb", "Banco X", "br_cnpj", "11222333000181", 20000000, false},
		{"LCIX", "lci", "Banco X", "br_cnpj", "11222333000181", 10000000, false},
		{"LFX", "lf", "Banco X", "br_cnpj", "11222333000181", 3000000, false},
		{"DEBY", "debenture", "Y", "", "", 5000000, false},
	})

	got := exposureOf(t, h, h.Client)

	want := []issuerRow{
		{"Banco X", 33000000, 30000000, 3000000, 25000000, 5000000},
		{"Y", 5000000, 0, 5000000, 25000000, 0},
	}
	if rows := rowsOfExposure(got); !reflect.DeepEqual(rows, want) {
		t.Fatalf("issuers = %+v, want %+v", rows, want)
	}

	if got.PeriodNote {
		t.Fatalf("period_note = true, want false")
	}

	g := got.Guarantee
	if g == nil || g.Name != "FGC" || g.LimitPerIssuer.Amount != 25000000 ||
		g.LimitPerPeriod.Amount != 100000000 || g.PeriodYears != 4 {
		t.Fatalf("guarantee = %+v", g)
	}
}

// A security the state issues is outside the deposit guarantee and is not uncovered credit.
func TestExposureOfSovereignSecurity(t *testing.T) {
	t.Parallel()
	h := newExposureBook(t, apitest.Brazil(), []exposureHolding{
		{"LFT.20290301", "tesouro", "Tesouro Nacional", "", "", 4000000, false},
		{"DEBY", "debenture", "Y", "", "", 1000000, false},
	})

	got := exposureOf(t, h, h.Client)

	if len(got.Issuers) != 2 {
		t.Fatalf("issuers = %+v, want 2", got.Issuers)
	}

	state, credit := got.Issuers[0], got.Issuers[1]
	if state.SovereignValue.Amount != 4000000 || state.UncoveredValue.Amount != 0 ||
		state.CoveredValue.Amount != 0 || state.MarketValue.Amount != 4000000 {
		t.Fatalf("sovereign row = %+v, want 4000000 sovereign and 0 uncovered", state)
	}

	if credit.SovereignValue.Amount != 0 || credit.UncoveredValue.Amount != 1000000 {
		t.Fatalf("credit row = %+v, want 0 sovereign and 1000000 uncovered", credit)
	}
}

func TestS521PeriodNote(t *testing.T) {
	t.Parallel()
	h := newExposureBook(t, apitest.Brazil(), []exposureHolding{
		{"CDBA", "cdb", "Banco A", "br_cnpj", "00000000000191", 26000000, false},
		{"CDBB", "cdb", "Banco B", "br_cnpj", "00000000000272", 26000000, false},
		{"CDBC", "cdb", "Banco C", "br_cnpj", "00000000000353", 26000000, false},
		{"CDBD", "cdb", "Banco D", "br_cnpj", "00000000000434", 26000000, false},
	})

	got := exposureOf(t, h, h.Client)

	for _, x := range got.Issuers {
		if x.Excess == nil || x.Excess.Amount != 1000000 {
			t.Fatalf("excess = %+v, want 1000000", x.Excess)
		}
	}

	if len(got.Issuers) != 4 || !got.PeriodNote {
		t.Fatalf("issuers = %d, period_note = %v", len(got.Issuers), got.PeriodNote)
	}
}

func TestS522HoldingWithoutIssuer(t *testing.T) {
	t.Parallel()
	h := newExposureBook(t, apitest.Brazil(), []exposureHolding{
		{"CDBZ", "cdb", "", "", "", 100000, false},
		{"CDBX", "cdb", "Banco X", "br_cnpj", "11222333000181", 5000, false},
	})

	got := exposureOf(t, h, h.Client)

	if len(got.Issuers) != 2 {
		t.Fatalf("issuers = %+v", got.Issuers)
	}

	last := got.Issuers[1]
	if last.Issuer != nil || last.Key != nil || last.MarketValue.Amount != 100000 {
		t.Fatalf("last group = %+v, want no issuer and 100000", last)
	}
}

func TestS523HoldingWithoutPrice(t *testing.T) {
	t.Parallel()
	h := newExposureBook(t, apitest.Brazil(), []exposureHolding{
		{"CDBX", "cdb", "Banco X", "br_cnpj", "11222333000181", 100000, false},
		{"CDBN", "cdb", "Banco X", "br_cnpj", "11222333000181", 900000, true},
	})

	got := exposureOf(t, h, h.Client)

	if !reflect.DeepEqual(got.MissingPrices, []string{"CDBN"}) {
		t.Fatalf("missing_prices = %v", got.MissingPrices)
	}

	want := []issuerRow{{"Banco X", 100000, 100000, 0, 25000000, 0}}
	if rows := rowsOfExposure(got); !reflect.DeepEqual(rows, want) {
		t.Fatalf("issuers = %+v, want %+v", rows, want)
	}
}

func TestS524RegionWithoutGuarantee(t *testing.T) {
	t.Parallel()

	de := apitest.Profile{
		Name:   "germany",
		Locale: locale.Locale{Language: "de", Region: "DE"},
		Base:   "EUR",
	}
	h := newExposureBook(t, de, []exposureHolding{
		{"BUND", "bond", "Bund", "", "", 100000, false},
	})

	got := exposureOf(t, h, h.Client)

	if got.Guarantee != nil {
		t.Fatalf("guarantee = %+v, want none", got.Guarantee)
	}

	if len(got.Issuers) != 1 || got.Issuers[0].Limit != nil || got.Issuers[0].Excess != nil {
		t.Fatalf("issuers = %+v, want one without limit or excess", got.Issuers)
	}
}

func TestS525ExposureOfAnotherBook(t *testing.T) {
	t.Parallel()
	h := newExposureBook(t, apitest.Brazil(), []exposureHolding{
		{"CDBX", "cdb", "Banco X", "br_cnpj", "11222333000181", 20000000, false},
	})
	other := h.LoginAs("other@example.com", locale.Locale{Language: "pt", Region: "BR"}, "BRL")

	got := exposureOf(t, h, other)

	if len(got.Issuers) != 0 || len(got.MissingPrices) != 0 {
		t.Fatalf("other book = %+v, want none", got)
	}
}

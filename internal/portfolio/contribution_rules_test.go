package portfolio_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type ruleOut struct {
	InstrumentType  string   `json:"instrument_type"`
	Subtypes        []string `json:"subtypes"`
	ReturnKind      string   `json:"return_kind"`
	MaturesFromYear int      `json:"matures_from_year"`
	MaturesToYear   int      `json:"matures_to_year"`
	DailyLiquidity  *bool    `json:"daily_liquidity"`
	Guarantee       string   `json:"guarantee"`
}

type matchedOut struct {
	Instrument string   `json:"instrument"`
	Value      moneyOut `json:"value"`
	ShareBP    *int     `json:"share_bp"`
}

// matchedRow is a matched security with its share (0 when absent).
type matchedRow struct {
	Instrument string
	Value      int64
	ShareBP    int
}

// rulesFixture holds, in one brokerage funded exactly: a CDB of 10,000.00 and an LCI of 5,000.00
// (applications priced on 2026-10-30), NTNB.20350515 of 3,000.00 and BOVA11 of 2,000.00 (GR12).
type rulesFixture struct {
	contributionFixture
	lci, ntnb string
}

const ntnbCode = "NTNB.20350515"

func newRulesFixture(t *testing.T) rulesFixture {
	t.Helper()

	f := newFixture(t)
	f.fund(t, 2000000)

	cdb := f.applyContract(t, "cdb", "2027-01-04", false, 1000000)
	lci := f.applyContract(t, "lci", "2028-01-04", true, 500000)
	f.holdSecurity(t, "BOVA11", "etf", 20, "100.00")
	f.holdSecurity(t, ntnbCode, "fixed_income", 30, "100.00")

	f.price(t, cdb, "1.00")
	f.price(t, lci, "1.00")
	f.h.Dispatch()

	return rulesFixture{
		contributionFixture: contributionFixture{fixture: f, cdb: cdb},
		lci:                 lci,
		ntnb:                ntnbCode,
	}
}

// gr12 is the plan of GR12.
func (f rulesFixture) gr12() map[string]any {
	return map[string]any{"classes": []any{
		ruleClass("Reserva", 2000, map[string]any{"daily_liquidity": true}),
		ruleClass(
			"Pós",
			3000,
			map[string]any{"instrument_type": "fixed_income", "return_kind": "rate"},
		),
		ruleClass("IPCA+", 2000, map[string]any{
			"return_kind": "inflation", "matures_from_year": 2031, "matures_to_year": 2040,
		}),
		contributionClass("Ações", 3000, instrumentMember("BOVA11")),
	}}
}

func ruleClass(name string, targetBP int, rules ...map[string]any) map[string]any {
	return map[string]any{
		"name": name, "target_bp": targetBP, "members": []any{}, "rules": rules,
	}
}

func (f fixture) fund(t *testing.T, amount int64) {
	t.Helper()
	f.h.Record("2026-10-01", apitest.Posting(f.cash, amount), apitest.Posting(f.dividends, -amount))
}

// applyContract records a fixed income application on 2026-10-01 and returns the contract code.
func (f fixture) applyContract(
	t *testing.T,
	subtype, maturesOn string,
	dailyLiquidity bool,
	amount int64,
) string {
	t.Helper()

	var out struct {
		Instrument string `json:"instrument"`
	}

	f.h.MustDo(http.MethodPost, "/api/v1/fixed-income-applications", map[string]any{
		"application_id":  uuid.NewString(),
		"brokerage_id":    f.xp,
		"cash_account_id": f.cash,
		"applied_on":      "2026-10-01",
		"amount":          map[string]any{"amount": amount, "currency": "BRL"},
		"contract": map[string]any{
			"subtype":             subtype,
			"issuer":              "Banco Matriz",
			"issued_on":           "2026-10-01",
			"matures_on":          maturesOn,
			"day_count":           "bus252",
			"index_id":            "cdi",
			"percent_of_index_bp": 10000,
			"daily_liquidity":     dailyLiquidity,
		},
	}, http.StatusCreated, &out)
	f.h.Dispatch()

	return out.Instrument
}

// holdSecurity creates code and buys quantity units at price on 2026-10-10, priced on 2026-10-30.
func (f fixture) holdSecurity(t *testing.T, code, typ string, quantity int64, price string) {
	t.Helper()

	f.h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": code, "type": typ, "scale": 0, "name": code, "quote_currency": "BRL",
	}, http.StatusCreated, nil)
	f.h.MustDo(http.MethodPost, "/api/v1/trades", map[string]any{
		"account_id":      f.holdingAccount(code),
		"cash_account_id": f.cash,
		"side":            "buy",
		"date":            "2026-10-10",
		"quantity":        units(quantity, code),
		"unit_price":      price,
	}, http.StatusCreated, nil)
	f.price(t, code, price)
	f.h.Dispatch()
}

func (f fixture) price(t *testing.T, code, value string) {
	t.Helper()
	f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
		"instrument":       code,
		"quote_instrument": "BRL",
		"date":             "2026-10-30",
		"value":            value,
	}, http.StatusCreated, nil)
}

func (c classOut) rows(t *testing.T) []matchedRow {
	t.Helper()

	out := []matchedRow{}

	for _, m := range c.Matched {
		if m.ShareBP == nil {
			t.Fatalf("matched %q of %q has no share: %+v", m.Instrument, c.Name, c)
		}

		out = append(out, matchedRow{m.Instrument, m.Value.Amount, *m.ShareBP})
	}

	return out
}

func wantRows(t *testing.T, c classOut, want ...matchedRow) {
	t.Helper()

	got := c.rows(t)
	if !slices.Equal(got, append([]matchedRow{}, want...)) {
		t.Errorf("matched of %q = %+v, want %+v", c.Name, got, want)
	}
}

// S640: a group by rule values the securities that meet one of its rules, and an outside security
// states its return kind.
func TestS640RuleClassValuesItsContracts(t *testing.T) {
	t.Parallel()
	f := newRulesFixture(t)

	got := f.save(t, f.gr12())

	if want := []int64{500000, 1000000, 300000, 200000}; !slices.Equal(got.values(), want) {
		t.Fatalf("values = %v, want %v", got.values(), want)
	}

	if got.Status != "complete" || len(got.Outside) != 0 {
		t.Fatalf("status %q, outside %+v, want complete and none", got.Status, got.Outside)
	}

	wantRows(t, got.Classes[0], matchedRow{f.lci, 500000, 10000})
	wantRows(t, got.Classes[1], matchedRow{f.cdb, 1000000, 10000})
	wantRows(t, got.Classes[2], matchedRow{f.ntnb, 300000, 10000})
	wantRows(t, got.Classes[3])

	if len(got.Classes[1].Rules) != 1 || got.Classes[1].Rules[0].ReturnKind != "rate" ||
		got.Classes[1].Rules[0].InstrumentType != "fixed_income" {
		t.Errorf("rules of Pós = %+v", got.Classes[1].Rules)
	}

	plan := map[string]any{"classes": []any{
		ruleClass("Reserva", 2000, map[string]any{"daily_liquidity": true}),
		ruleClass(
			"Pós",
			3000,
			map[string]any{"instrument_type": "fixed_income", "return_kind": "rate"},
		),
		contributionClass("Ações", 5000, instrumentMember("BOVA11")),
	}}

	outside := f.save(t, plan).Outside
	if len(outside) != 1 || outside[0].Instrument != ntnbCode ||
		outside[0].ReturnKind != "inflation" {
		t.Errorf("outside = %+v, want %s inflation", outside, ntnbCode)
	}
}

// S641: an instrument member wins over a rule, and the first group in plan order wins among rules.
func TestS641MemberAndOrderWin(t *testing.T) {
	t.Parallel()
	f := newRulesFixture(t)

	plan := f.gr12()
	plan["classes"].([]any)[3] = contributionClass(
		"Ações", 3000, instrumentMember("BOVA11"), instrumentMember(f.cdb),
	)

	got := f.save(t, plan)

	if want := []int64{500000, 0, 300000, 1200000}; !slices.Equal(got.values(), want) {
		t.Fatalf("values = %v, want %v", got.values(), want)
	}

	wantRows(t, got.Classes[0], matchedRow{f.lci, 500000, 10000})
	wantRows(t, got.Classes[1])
}

// S642: the facts of a government bond come from its code.
func TestS642GovernmentBondFacts(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.fund(t, 400000)
	f.holdSecurity(t, "LFT.20290301", "fixed_income", 10, "100.00")
	f.holdSecurity(t, ntnbCode, "fixed_income", 30, "100.00")
	c := contributionFixture{fixture: f}

	got := c.save(t, map[string]any{"classes": []any{
		ruleClass("Liquidez", 5000, map[string]any{"return_kind": "rate", "daily_liquidity": true}),
		ruleClass(
			"Longo",
			5000,
			map[string]any{"return_kind": "inflation", "matures_from_year": 2035},
		),
	}})

	wantRows(t, got.Classes[0], matchedRow{"LFT.20290301", 100000, 10000})
	wantRows(t, got.Classes[1], matchedRow{ntnbCode, 300000, 10000})

	got = c.save(t, map[string]any{"classes": []any{
		ruleClass("Liquidez", 10000, map[string]any{"daily_liquidity": true}),
	}})

	wantRows(t, got.Classes[0], matchedRow{"LFT.20290301", 100000, 10000})

	if len(got.Outside) != 1 || got.Outside[0].Instrument != ntnbCode {
		t.Errorf("outside = %+v, want only %s", got.Outside, ntnbCode)
	}
}

// S643: a matched contract without a price makes the plan incomplete.
func TestS643MatchedWithoutPrice(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.fund(t, 1000000)
	code := f.applyContract(t, "cdb", "2027-01-04", false, 1000000)

	got := contributionFixture{fixture: f}.save(t, map[string]any{"classes": []any{
		ruleClass("Pós", 10000, map[string]any{"instrument_type": "fixed_income"}),
	}})

	if got.Status != "incomplete" || len(got.Missing) != 1 || got.Missing[0].Instrument != code {
		t.Errorf("status %q, missing %+v, want incomplete with %s", got.Status, got.Missing, code)
	}
}

// S644: the guarantee condition needs a jurisdiction with a guarantee in the base currency.
func TestS644GuaranteeOutsideBrazil(t *testing.T) {
	t.Parallel()

	plan := map[string]any{"classes": []any{
		ruleClass("Cobertos", 10000, map[string]any{"guarantee": "covered"}),
	}}

	br := newFixture(t)
	c := contributionFixture{fixture: br}

	if got := c.get(t); got.GuaranteeName != "FGC" {
		t.Errorf("guarantee_name = %q, want FGC", got.GuaranteeName)
	}

	c.save(t, plan)

	de := newFixture(t)
	de.moveToRegion(t, "DE")
	de.h.ExpectProblem(
		de.h.Do(http.MethodPut, contributionPath, plan),
		http.StatusUnprocessableEntity,
		"contribution_rule_invalid",
		"",
	)
}

// S645: a group that breaks GR1 or GR2 is refused; more than five rules break the schema.
func TestS645InvalidRules(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	six := make([]map[string]any, 6)
	for i := range six {
		six[i] = map[string]any{"instrument_type": "fixed_income"}
	}

	withMember := ruleClass("Both", 10000, map[string]any{"instrument_type": "fixed_income"})
	withMember["members"] = []any{instrumentMember("PETR4")}

	tests := []struct {
		name   string
		class  map[string]any
		status int
		code   string
	}{
		{"members and rules", withMember, 422, "contribution_rule_invalid"},
		{
			"empty rule",
			ruleClass("Empty", 10000, map[string]any{}),
			422,
			"contribution_rule_invalid",
		},
		{
			"subtypes without type",
			ruleClass("Sub", 10000, map[string]any{"subtypes": []string{"cdb"}}),
			422, "contribution_rule_invalid",
		},
		{
			"years reversed",
			ruleClass("Years", 10000, map[string]any{
				"matures_from_year": 2035, "matures_to_year": 2030,
			}),
			422, "contribution_rule_invalid",
		},
		{"six rules", ruleClass("Six", 10000, six...), 400, "invalid_request"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f.h.ExpectProblem(
				f.h.Do(
					http.MethodPut,
					contributionPath,
					map[string]any{"classes": []any{tt.class}},
				),
				tt.status,
				tt.code,
				"",
			)
		})
	}
}

// S646: the preview values the draft by rule; without an amount it splits nothing.
func TestS646PreviewOfRules(t *testing.T) {
	t.Parallel()
	f := newRulesFixture(t)

	plan := f.gr12()
	plan["amount"] = apitest.BRL(200000)

	got := f.preview(t, plan)
	if want := []int64{0, 0, 0, 200000}; !slices.Equal(got.amounts(t), want) {
		t.Errorf("amounts = %v, want %v", got.amounts(t), want)
	}

	got = f.preview(t, f.gr12())

	for _, c := range got.Classes {
		if c.Amount != nil {
			t.Errorf("class %q has amount %+v without a preview amount", c.Name, c.Amount)
		}
	}

	wantRows(t, got.Classes[1], matchedRow{f.cdb, 1000000, 10000})
}

// S647: a contract in another currency than the base counts at the converted value.
func TestS647RuleClassForeignBase(t *testing.T) {
	t.Parallel()

	f := newFixture(t, apitest.As(apitest.Profile{
		Name:   "nz_usd",
		Locale: locale.Locale{Language: "en", Region: "NZ"},
		Base:   "USD",
	}))
	for _, date := range []string{"2026-10-01", "2026-10-30"} {
		f.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
			"instrument":       "BRL",
			"quote_instrument": "USD",
			"date":             date,
			"value":            "0.20",
		}, http.StatusCreated, nil)
	}

	f.cash = f.h.Account("XP cash USD", "asset", "brokerage", map[string]any{
		"institution_id": f.institution, "currency": "USD",
	})
	f.h.Record("2026-10-01", f.h.Posting(f.cash, 20000), f.h.Posting(f.dividends, -20000))

	code := f.applyContract(t, "cdb", "2027-01-04", false, 100000)
	f.price(t, code, "1.00")
	f.h.Dispatch()

	got := contributionFixture{fixture: f}.save(t, map[string]any{"classes": []any{
		ruleClass("Pós", 10000, map[string]any{"instrument_type": "fixed_income"}),
	}})

	if got.Total.Currency != "USD" || !slices.Equal(got.values(), []int64{20000}) {
		t.Errorf("total %+v, values %v, want 20000 USD", got.Total, got.values())
	}

	wantRows(t, got.Classes[0], matchedRow{code, 20000, 10000})
}

// TestSaveRulesTool saves the plan of GR12 through save_contribution_plan and reads its rules,
// matched securities and guarantee name through get_portfolio view contribution (GR11).
func TestSaveRulesTool(t *testing.T) {
	t.Parallel()
	f := newRulesFixture(t)

	type toolClass struct {
		Name    string    `json:"name"`
		Rules   []ruleOut `json:"rules"`
		Matched []struct {
			Instrument string     `json:"instrument"`
			Value      tool.Money `json:"value"`
			ShareBP    int        `json:"share_bp"`
		} `json:"matched"`
	}

	type toolView struct {
		GuaranteeName string      `json:"guarantee_name"`
		Classes       []toolClass `json:"classes"`
	}

	var saved toolView
	toolOutput(t, f.h, "save_contribution_plan", f.gr12(), &saved)

	var read struct {
		Contribution toolView `json:"contribution"`
	}
	toolOutput(t, f.h, "get_portfolio", map[string]any{"view": "contribution"}, &read)

	got := read.Contribution

	if got.GuaranteeName == "" || len(got.Classes) != 4 || len(saved.Classes) != 4 {
		t.Fatalf("view = %+v, saved = %+v", got, saved)
	}

	reserve := got.Classes[0]
	if len(reserve.Rules) != 1 || reserve.Rules[0].DailyLiquidity == nil ||
		!*reserve.Rules[0].DailyLiquidity {
		t.Errorf("rules of Reserva = %+v", reserve.Rules)
	}

	ipca := got.Classes[2].Rules
	if len(ipca) != 1 || ipca[0].ReturnKind != "inflation" || ipca[0].MaturesFromYear != 2031 ||
		ipca[0].MaturesToYear != 2040 {
		t.Errorf("rules of IPCA+ = %+v", ipca)
	}

	if m := got.Classes[1].Matched; len(m) != 1 || m[0].Instrument != f.cdb ||
		m[0].Value.Amount != "10000.00" || m[0].ShareBP != 10000 {
		t.Errorf("matched of Pós = %+v", m)
	}

	if m := got.Classes[2].Matched; len(m) != 1 || m[0].Instrument != f.ntnb ||
		m[0].Value.Amount != "3000.00" {
		t.Errorf("matched of IPCA+ = %+v", m)
	}

	if len(got.Classes[3].Rules) != 0 || len(got.Classes[3].Matched) != 0 {
		t.Errorf("Ações = %+v", got.Classes[3])
	}
}

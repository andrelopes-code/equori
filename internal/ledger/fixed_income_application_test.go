package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

const (
	fixedIncomeCode        = "RF.280302.CS3YS"
	fixedIncomeApplication = "0192f3a4-5b6c-7d8e-9f00-112233445566"
	fixedIncomePath        = "/api/v1/fixed-income-applications"
)

type fixedIncomeOut struct {
	Instrument    string         `json:"instrument"`
	TransactionID string         `json:"transaction_id"`
	Quantity      map[string]any `json:"quantity"`
	UnitPrice     string         `json:"unit_price"`
}

func TestS479NewContract(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)

	var out fixedIncomeOut

	f.h.MustDo(
		http.MethodPost,
		fixedIncomePath,
		f.newContractBody("2026-03-02", 1000000),
		http.StatusCreated,
		&out,
	)

	if out.Instrument != fixedIncomeCode || out.UnitPrice != "1.000000000000" ||
		out.Quantity["amount"] != float64(
			10000000000,
		) || out.Quantity["currency"] != fixedIncomeCode {
		t.Fatalf("result = %+v", out)
	}

	tx := f.h.Transaction(out.TransactionID)
	if len(tx.Postings) != 2 {
		t.Fatalf("postings = %+v", tx.Postings)
	}

	for _, p := range tx.Postings {
		if p.AccountID == f.cash && p.Amount.Amount != -1000000 {
			t.Fatalf("cash posting = %+v", p)
		}

		if p.AccountID != f.cash && p.AccountID == f.xp {
			t.Fatalf("holding posting is on the brokerage: %+v", p)
		}
	}
}

// S496: a contract with interest_every_months stores the expanded payments.
func TestS496InterestSchedule(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	body := f.newContractBody("2026-03-02", 1000000)
	contract := body["contract"].(map[string]any)
	contract["interest_every_months"] = 6
	contract["first_payment_on"] = "2026-09-02"

	f.h.MustDo(http.MethodPost, fixedIncomePath, body, http.StatusCreated, nil)

	var terms struct {
		Payments []struct {
			PaysOn         string `json:"pays_on"`
			AmortizationBP int    `json:"amortization_bp"`
			PaysInterest   bool   `json:"pays_interest"`
		} `json:"payments"`
	}

	f.h.MustDo(
		http.MethodGet, "/api/v1/instruments/"+fixedIncomeCode+"/terms", nil, http.StatusOK, &terms,
	)

	want := []string{"2026-09-02", "2027-03-02", "2027-09-02", "2028-03-02"}
	if len(terms.Payments) != len(want) {
		t.Fatalf("payments = %+v", terms.Payments)
	}

	for i, p := range terms.Payments {
		if p.PaysOn != want[i] || !p.PaysInterest || p.AmortizationBP != 0 {
			t.Fatalf("payments[%d] = %+v, want interest on %s", i, p, want[i])
		}
	}
}

func TestS480ReplayedApplication(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	body := f.newContractBody("2026-03-02", 1000000)

	var first, again fixedIncomeOut

	f.h.MustDo(http.MethodPost, fixedIncomePath, body, http.StatusCreated, &first)
	f.h.MustDo(http.MethodPost, fixedIncomePath, body, http.StatusOK, &again)

	if again.TransactionID != first.TransactionID || again.Instrument != first.Instrument {
		t.Fatalf("replay = %+v, first = %+v", again, first)
	}

	if n := f.h.Rows(`SELECT transaction_id FROM ledger_trade WHERE side = 'buy'`); len(n) != 1 {
		t.Fatalf("trades = %v", n)
	}
}

func TestS481Contribution(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		priceDate string
		appliedOn string
	}{
		{name: "business day", priceDate: "2026-06-01", appliedOn: "2026-06-01"},
		{name: "saturday takes the friday price", priceDate: "2026-06-05", appliedOn: "2026-06-06"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			f := newInvestFixture(t)
			f.h.MustDo(
				http.MethodPost, fixedIncomePath, f.newContractBody("2026-03-02", 1000000),
				http.StatusCreated, nil,
			)
			f.price(t, fixedIncomeCode, tt.priceDate, "1.234567")

			var out fixedIncomeOut

			f.h.MustDo(
				http.MethodPost,
				fixedIncomePath,
				f.contributionBody(tt.appliedOn, 100000),
				http.StatusCreated,
				&out,
			)

			if out.Quantity["amount"] != float64(810000591) || out.UnitPrice != "1.234567000458" {
				t.Fatalf("result = %+v", out)
			}

			var trade tradeTx

			f.h.MustDo(
				http.MethodGet,
				"/api/v1/transactions/"+out.TransactionID,
				nil,
				http.StatusOK,
				&trade,
			)

			if trade.Trade == nil || trade.Trade.Gross["amount"] != float64(100000) {
				t.Fatalf("trade = %+v", trade.Trade)
			}
		})
	}
}

func TestS482ContributionWithoutPrice(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost, fixedIncomePath, f.newContractBody("2026-03-02", 1000000),
		http.StatusCreated, nil,
	)

	r := f.h.Do(http.MethodPost, fixedIncomePath, f.contributionBody("2026-03-01", 100000))

	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "price_missing", "")
}

func TestS483ContractOfAnotherBook(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost, fixedIncomePath, f.newContractBody("2026-03-02", 1000000),
		http.StatusCreated, nil,
	)

	other := f.h.Login("book-b@example.com")

	var inst idOnly

	r := f.h.Call(
		other,
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": "Other"},
	)
	r.Decode(t, &inst)

	var brokerage, cash idOnly

	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{
		"name": "Other brokerage", "class": "asset", "kind": "brokerage",
		"currency": "BRL", "institution_id": inst.ID,
	}).Decode(t, &brokerage)
	f.h.Call(other, http.MethodPost, "/api/v1/accounts", map[string]any{
		"name": "Other cash", "class": "asset", "kind": "brokerage",
		"currency": "BRL", "institution_id": inst.ID, "parent_id": brokerage.ID,
	}).Decode(t, &cash)

	body := f.contributionBody("2026-06-01", 100000)
	body["brokerage_id"] = brokerage.ID
	body["cash_account_id"] = cash.ID

	r = f.h.Call(other, http.MethodPost, fixedIncomePath, body)

	f.h.ExpectProblem(r, http.StatusNotFound, "not_found", "")
}

func TestS484ContractInvalid(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	body := f.newContractBody("2026-03-02", 1000000)
	body["contract"].(map[string]any)["matures_on"] = "2026-03-01"

	r := f.h.Do(http.MethodPost, fixedIncomePath, body)

	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "contract_invalid", "contract.matures_on")
	f.expectNoContract(t)
}

func TestS485CashAmbiguousDiscardsTheContract(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.Account("XP cash 2", "asset", "brokerage", map[string]any{
		"institution_id": f.institution, "parent_id": f.xp, "currency": "BRL",
	})

	body := f.newContractBody("2026-03-02", 1000000)
	delete(body, "cash_account_id")

	r := f.h.Do(http.MethodPost, fixedIncomePath, body)

	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "brokerage_cash_ambiguous", "")
	f.expectNoContract(t)
}

func TestFixedIncomeApplicationRoleRead(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")

	r := f.h.Call(
		reader,
		http.MethodPost,
		fixedIncomePath,
		f.newContractBody("2026-03-02", 1000000),
	)

	if r.Status != http.StatusForbidden {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}
}

func TestFixedIncomeApplicationContractAndInstrument(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	body := f.newContractBody("2026-03-02", 1000000)
	body["instrument"] = fixedIncomeCode

	r := f.h.Do(http.MethodPost, fixedIncomePath, body)

	f.h.ExpectProblem(r, http.StatusUnprocessableEntity, "validation_failed", "contract")
}

func TestFixedIncomeApplicationUSDBook(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	usd := h.LoginAs("usd-book@example.com", locale.Locale{Language: "pt", Region: "BR"}, "USD")

	create := func(path string, body map[string]any) string {
		var out idOnly

		r := h.Call(usd, http.MethodPost, path, body)
		if r.Status != http.StatusCreated {
			t.Fatalf("POST %s = %d: %s", path, r.Status, r.Body)
		}

		r.Decode(t, &out)

		return out.ID
	}

	institution := create("/api/v1/institutions", map[string]any{"name": "Broker"})
	brokerage := create("/api/v1/accounts", map[string]any{
		"name": "Broker", "class": "asset", "kind": "brokerage",
		"currency": "USD", "institution_id": institution,
	})
	cash := create("/api/v1/accounts", map[string]any{
		"name": "Broker cash", "class": "asset", "kind": "brokerage",
		"currency": "USD", "institution_id": institution, "parent_id": brokerage,
	})

	var out fixedIncomeOut

	r := h.Call(usd, http.MethodPost, fixedIncomePath, map[string]any{
		"application_id":  fixedIncomeApplication,
		"brokerage_id":    brokerage,
		"cash_account_id": cash,
		"applied_on":      "2026-03-02",
		"amount":          map[string]any{"amount": 1000000, "currency": "USD"},
		"contract": map[string]any{
			"subtype":    "cdb",
			"issuer":     "Banco X",
			"matures_on": "2028-03-02",
			"spread_bp":  1200,
		},
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("status = %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &out)

	var in struct {
		QuoteCurrency string `json:"quote_currency"`
	}

	h.Call(usd, http.MethodGet, "/api/v1/instruments/"+fixedIncomeCode, nil).Decode(t, &in)

	var terms struct {
		FaceValue int64 `json:"face_value"`
	}

	h.Call(usd, http.MethodGet, "/api/v1/instruments/"+fixedIncomeCode+"/terms", nil).
		Decode(t, &terms)

	if in.QuoteCurrency != "USD" || terms.FaceValue != 100 ||
		out.Quantity["amount"] != float64(10000000000) {
		t.Fatalf("instrument = %+v, terms = %+v, result = %+v", in, terms, out)
	}
}

func (f investFixture) newContractBody(appliedOn string, amount int64) map[string]any {
	return map[string]any{
		"application_id":  fixedIncomeApplication,
		"brokerage_id":    f.xp,
		"cash_account_id": f.cash,
		"applied_on":      appliedOn,
		"amount":          apitest.BRL(amount),
		"contract": map[string]any{
			"subtype":             "cdb",
			"issuer":              "Banco X",
			"matures_on":          "2028-03-02",
			"index_id":            "cdi",
			"percent_of_index_bp": 11000,
		},
	}
}

func (f investFixture) contributionBody(appliedOn string, amount int64) map[string]any {
	return map[string]any{
		"application_id":  "0192f3a4-5b6c-7d8e-9f00-aabbccddeeff",
		"brokerage_id":    f.xp,
		"cash_account_id": f.cash,
		"applied_on":      appliedOn,
		"amount":          apitest.BRL(amount),
		"instrument":      fixedIncomeCode,
	}
}

func (f investFixture) price(t *testing.T, code, date, value string) {
	t.Helper()
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/prices",
		map[string]any{
			"instrument":       code,
			"quote_instrument": "BRL",
			"date":             date,
			"value":            value,
		},
		http.StatusCreated,
		nil,
	)
}

func (f investFixture) expectNoContract(t *testing.T) {
	t.Helper()

	if rows := f.h.Rows(
		`SELECT code FROM marketdata_instrument WHERE code LIKE 'RF.%'`,
	); len(
		rows,
	) != 0 {
		t.Fatalf("contracts defined = %v", rows)
	}
}

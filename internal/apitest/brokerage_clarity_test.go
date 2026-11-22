package apitest_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const (
	tradesPath  = "/api/v1/trades"
	openingCash = 1000000
)

type brokerageSetup struct {
	h           *apitest.Harness
	institution string
	brokerage   string
	cash        string
}

type accountItem struct {
	ID       string `json:"id"`
	ParentID string `json:"parent_id"`
	Currency string `json:"currency"`
	Name     string `json:"name"`
}

func TestS387TradeWithInstrumentCreatesTheHolding(t *testing.T) {
	t.Parallel()
	s := newBrokerageSetup(t, apitest.Brazil())

	s.h.MustDo(http.MethodPost, tradesPath, s.buy("2026-10-05", 10), http.StatusCreated, nil)

	holdings := s.holdings(t, "AUVP11")
	if len(holdings) != 1 || holdings[0].Name != "AUVP11" {
		t.Fatalf("holdings = %+v, want one named AUVP11", holdings)
	}

	var tx struct {
		Postings []struct {
			AccountID string `json:"account_id"`
		} `json:"postings"`
	}
	s.h.MustDo(http.MethodPost, tradesPath, s.buy("2026-10-06", 5), http.StatusCreated, &tx)

	if len(tx.Postings) != 2 || tx.Postings[0].AccountID != s.cash ||
		tx.Postings[1].AccountID != holdings[0].ID {
		t.Fatalf("postings = %+v, want cash %s and holding %s", tx.Postings, s.cash, holdings[0].ID)
	}
}

func TestS388SecondTradeReusesTheHolding(t *testing.T) {
	t.Parallel()
	s := newBrokerageSetup(t, apitest.Brazil())

	s.h.MustDo(http.MethodPost, tradesPath, s.buy("2026-10-05", 10), http.StatusCreated, nil)

	sale := s.buy("2026-10-20", 4)
	sale["side"] = "sell"
	s.h.MustDo(http.MethodPost, tradesPath, sale, http.StatusCreated, nil)

	if got := s.holdings(t, "AUVP11"); len(got) != 1 {
		t.Fatalf("holdings = %+v, want one", got)
	}
}

func TestS389TradeNamesOneFormOfTarget(t *testing.T) {
	t.Parallel()
	s := newBrokerageSetup(t, apitest.Brazil())

	both := s.buy("2026-10-05", 10)
	both["account_id"] = s.cash

	neither := s.buy("2026-10-05", 10)
	delete(neither, "brokerage_id")
	delete(neither, "instrument")

	half := s.buy("2026-10-05", 10)
	delete(half, "instrument")

	for name, body := range map[string]map[string]any{"both": both, "neither": neither, "half": half} {
		t.Run(name, func(t *testing.T) {
			s.h.ExpectProblem(s.h.Do(http.MethodPost, tradesPath, body),
				http.StatusUnprocessableEntity, "trade_target_required", "")
		})
	}

	if got := s.holdings(t, "AUVP11"); len(got) != 0 {
		t.Fatalf("holdings = %+v, want none", got)
	}
}

func TestS390SeveralCashAccountsNeedACashAccountID(t *testing.T) {
	t.Parallel()
	s := newBrokerageSetup(t, apitest.Brazil())
	other := s.child("Other cash", string(s.h.Profile.Base))

	s.h.ExpectProblem(s.h.Do(http.MethodPost, tradesPath, s.buy("2026-10-05", 10)),
		http.StatusUnprocessableEntity, "brokerage_cash_ambiguous", "")

	body := s.buy("2026-10-05", 10)
	body["cash_account_id"] = other
	s.h.MustDo(http.MethodPost, tradesPath, body, http.StatusCreated, nil)
}

func TestS390BrokerageInAnotherCurrencyHasNoCash(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.As(apitest.ForeignBase()))
	h.MustDo(http.MethodPost, "/api/v1/instruments", security("AUVP11"), http.StatusCreated, nil)

	institution := institutionID(t, h)
	brokerage := h.Account(
		"BRL broker",
		"asset",
		"brokerage",
		map[string]any{"institution_id": institution, "currency": "BRL"},
	)
	h.Account(
		"BRL cash",
		"asset",
		"brokerage",
		map[string]any{"institution_id": institution, "parent_id": brokerage, "currency": "BRL"},
	)

	h.ExpectProblem(h.Do(http.MethodPost, tradesPath, map[string]any{
		"brokerage_id": brokerage, "instrument": "AUVP11", "side": "buy", "date": "2026-10-05",
		"quantity": map[string]any{"amount": 10, "currency": "AUVP11"}, "unit_price": "10",
	}), http.StatusUnprocessableEntity, "brokerage_cash_missing", "")
}

func TestS391BrokerageCashChildHoldsTheOpeningBalance(t *testing.T) {
	t.Parallel()
	s := newBrokerageSetup(t, apitest.Brazil())

	var out struct {
		Balance struct {
			Amount int64 `json:"amount"`
		} `json:"balance"`
	}
	s.h.MustDo(
		http.MethodGet,
		"/api/v1/accounts/"+s.cash+"/balance?date=2026-10-01",
		nil,
		http.StatusOK,
		&out,
	)

	if out.Balance.Amount != openingCash {
		t.Fatalf("cash balance = %d, want %d", out.Balance.Amount, openingCash)
	}
}

func TestS392IncomeWithInstrumentCreditsTheCashAccount(t *testing.T) {
	t.Parallel()
	s := newBrokerageSetup(t, apitest.Brazil())
	s.h.MustDo(http.MethodPost, tradesPath, s.buy("2026-10-05", 10), http.StatusCreated, nil)
	dividends := s.h.Account("Dividends", "income", "", nil)

	var tx struct {
		Postings []struct {
			AccountID string `json:"account_id"`
			Amount    struct {
				Amount int64 `json:"amount"`
			} `json:"amount"`
		} `json:"postings"`
	}
	s.h.MustDo(http.MethodPost, "/api/v1/investment-income", map[string]any{
		"brokerage_id": s.brokerage, "instrument": "AUVP11", "income_type": "dividend",
		"date": "2026-10-26", "gross": s.h.Money(1000), "category_id": dividends,
	}, http.StatusCreated, &tx)

	if len(tx.Postings) == 0 || tx.Postings[0].AccountID != s.cash ||
		tx.Postings[0].Amount.Amount != 1000 {
		t.Fatalf("postings = %+v, want +1000 on cash %s", tx.Postings, s.cash)
	}
}

func TestS393BuyPaidFromTheCheckingAccountOfTheInstitution(t *testing.T) {
	t.Parallel()
	s, checking := newOutsideSetup(t)

	body := s.buy("2026-10-05", 10)
	body["cash_account_id"] = checking

	var tx tradeResult
	s.h.MustDo(http.MethodPost, tradesPath, body, http.StatusCreated, &tx)

	if got := tx.amountOn(checking); got != -10000 {
		t.Fatalf("checking posting = %d, want -10000: %+v", got, tx.Postings)
	}

	if got := s.holdings(t, "AUVP11"); len(got) != 1 {
		t.Fatalf("holdings = %+v, want one", got)
	}
}

func TestS394AccountOfAnotherInstitutionIsRejected(t *testing.T) {
	t.Parallel()
	s, _ := newOutsideSetup(t)
	other := s.h.Account("Other checking", "asset", "checking", map[string]any{
		"institution_id": namedInstitution(t, s.h, "Other bank"),
	})

	body := s.buy("2026-10-05", 10)
	body["cash_account_id"] = other
	s.h.ExpectProblem(s.h.Do(http.MethodPost, tradesPath, body),
		http.StatusUnprocessableEntity, "validation_failed", "cash_account_id")
}

func TestS395BrokerageWithoutCashDefaultsToTheInstitutionAccount(t *testing.T) {
	t.Parallel()
	s, checking := newOutsideSetup(t)

	var tx tradeResult
	s.h.MustDo(http.MethodPost, tradesPath, s.buy("2026-10-05", 10), http.StatusCreated, &tx)

	if got := tx.amountOn(checking); got != -10000 {
		t.Fatalf("checking posting = %d, want -10000: %+v", got, tx.Postings)
	}
}

func TestS396CashAndInstitutionAccountAreAmbiguous(t *testing.T) {
	t.Parallel()
	s, checking := newOutsideSetup(t)
	s.child("Cash", string(s.h.Profile.Base))

	s.h.ExpectProblem(s.h.Do(http.MethodPost, tradesPath, s.buy("2026-10-05", 10)),
		http.StatusUnprocessableEntity, "brokerage_cash_ambiguous", "")

	body := s.buy("2026-10-05", 10)
	body["cash_account_id"] = checking
	s.h.MustDo(http.MethodPost, tradesPath, body, http.StatusCreated, nil)
}

func TestBrokerageWithoutCashAccount(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)
	h.MustDo(http.MethodPost, "/api/v1/instruments", security("AUVP11"), http.StatusCreated, nil)
	brokerage := h.Account(
		"Empty broker",
		"asset",
		"brokerage",
		map[string]any{"institution_id": institutionID(t, h)},
	)

	h.ExpectProblem(h.Do(http.MethodPost, tradesPath, map[string]any{
		"brokerage_id": brokerage, "instrument": "AUVP11", "side": "buy", "date": "2026-10-05",
		"quantity": map[string]any{"amount": 10, "currency": "AUVP11"}, "unit_price": "10",
	}), http.StatusUnprocessableEntity, "brokerage_cash_missing", "")
}

func TestSaleOfAnInstrumentNotHeld(t *testing.T) {
	t.Parallel()
	s := newBrokerageSetup(t, apitest.Brazil())

	sale := s.buy("2026-10-05", 10)
	sale["side"] = "sell"
	s.h.ExpectProblem(s.h.Do(http.MethodPost, tradesPath, sale),
		http.StatusUnprocessableEntity, "holding_not_found", "")

	if got := s.holdings(t, "AUVP11"); len(got) != 0 {
		t.Fatalf("holdings = %+v, want none", got)
	}
}

func TestTradeWithInstrumentRoles(t *testing.T) {
	t.Parallel()
	s := newBrokerageSetup(t, apitest.Brazil())
	owner := s.h.OwnerID()

	reader := s.h.JoinAs("reader@example.com", owner, "read")
	s.h.ExpectProblem(s.h.Call(reader, http.MethodPost, tradesPath, s.buy("2026-10-05", 1)),
		http.StatusForbidden, "book_role_required", "")

	for _, role := range []string{"write", "owner"} {
		c := s.h.JoinAs(role+"-user@example.com", owner, role)
		if r := s.h.Call(
			c,
			http.MethodPost,
			tradesPath,
			s.buy("2026-10-05", 1),
		); r.Status != http.StatusCreated {
			t.Fatalf("%s status = %d: %s", role, r.Status, r.Body)
		}
	}

	outsider := s.h.LoginMember("outsider@example.com")
	s.h.ExpectProblem(s.h.Call(outsider, http.MethodPost, tradesPath, s.buy("2026-10-05", 1)),
		http.StatusUnprocessableEntity, "invalid_account", "brokerage_id")

	if got := s.holdings(t, "AUVP11"); len(got) != 1 {
		t.Fatalf("holdings = %+v, want the one of the write and owner trades", got)
	}
}

// S397: an income paid outside the tree is an external flow of the return (BC15).
func TestS397_ReturnWithMoneyPaidOutside(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		incomeInto  func(s brokerageSetup, checking string) string
		wantClosing int64
		wantFlows   []flowOut
	}{
		{
			name:        "income paid into checking",
			incomeInto:  func(_ brokerageSetup, checking string) string { return checking },
			wantClosing: 12000,
			wantFlows:   []flowOut{{"2026-10-05", 10000}, {"2026-12-05", -500}},
		},
		{
			name:        "income paid into the cash account of the tree",
			incomeInto:  func(s brokerageSetup, _ string) string { return s.cash },
			wantClosing: 12500,
			wantFlows:   []flowOut{{"2026-10-05", 10000}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			s, checking := newOutsideSetup(t)
			s.cash = s.child("Cash", "BRL")

			buy := s.buy("2026-10-05", 10)
			buy["cash_account_id"] = checking
			s.h.MustDo(http.MethodPost, tradesPath, buy, http.StatusCreated, nil)

			for date, value := range map[string]string{"2026-10-05": "10", "2026-12-05": "12"} {
				s.h.MustDo(http.MethodPost, "/api/v1/prices", map[string]any{
					"instrument": "AUVP11", "quote_instrument": "BRL",
					"date": date, "value": value,
				}, http.StatusCreated, nil)
			}

			dividends := s.h.Account("Dividends", "income", "", nil)
			s.h.MustDo(http.MethodPost, "/api/v1/investment-income", map[string]any{
				"brokerage_id": s.brokerage, "instrument": "AUVP11", "income_type": "dividend",
				"date": "2026-12-05", "gross": s.h.Money(500), "category_id": dividends,
				"cash_account_id": tt.incomeInto(s, checking),
			}, http.StatusCreated, nil)
			s.h.Dispatch()

			var got struct {
				Flows []struct {
					Date   string `json:"date"`
					Amount struct {
						Amount int64 `json:"amount"`
					} `json:"amount"`
				} `json:"flows"`
				Opening struct {
					Amount int64 `json:"amount"`
				} `json:"opening"`
				Closing struct {
					Amount int64 `json:"amount"`
				} `json:"closing"`
			}
			s.h.MustDo(http.MethodGet, "/api/v1/reports/return?account_id="+s.brokerage+
				"&from=2026-10-05&to=2026-12-05&value_in=BRL", nil, http.StatusOK, &got)

			var flows []flowOut

			gain := got.Closing.Amount - got.Opening.Amount

			for _, f := range got.Flows {
				flows = append(flows, flowOut{f.Date, f.Amount.Amount})
				gain -= f.Amount.Amount
			}

			if got.Closing.Amount != tt.wantClosing || !slices.Equal(flows, tt.wantFlows) {
				t.Fatalf("closing = %d, flows = %+v, want %d, %+v",
					got.Closing.Amount, flows, tt.wantClosing, tt.wantFlows)
			}

			if gain != 2500 {
				t.Fatalf("gain = %d, want 2500", gain)
			}
		})
	}
}

type flowOut struct {
	Date   string
	Amount int64
}

func newBrokerageSetup(t *testing.T, profile apitest.Profile) brokerageSetup {
	t.Helper()

	h := apitest.New(t, apitest.As(profile))
	h.MustDo(http.MethodPost, "/api/v1/instruments", security("AUVP11"), http.StatusCreated, nil)

	s := brokerageSetup{h: h, institution: institutionID(t, h)}
	s.brokerage = h.Account(
		"XP",
		"asset",
		"brokerage",
		map[string]any{"institution_id": s.institution},
	)
	s.cash = s.child("Cash", string(profile.Base))
	s.openCash(t, openingCash)

	return s
}

// newOutsideSetup returns a brokerage without a cash account and a checking account of its
// institution.
func newOutsideSetup(t *testing.T) (brokerageSetup, string) {
	t.Helper()

	h := apitest.New(t, apitest.As(apitest.Brazil()))
	h.MustDo(http.MethodPost, "/api/v1/instruments", security("AUVP11"), http.StatusCreated, nil)

	s := brokerageSetup{h: h, institution: institutionID(t, h)}
	s.brokerage = h.Account(
		"Inter",
		"asset",
		"brokerage",
		map[string]any{"institution_id": s.institution},
	)
	checking := h.Account(
		"Checking",
		"asset",
		"checking",
		map[string]any{"institution_id": s.institution},
	)

	return s, checking
}

func (s brokerageSetup) child(name, currency string) string {
	return s.h.Account(name, "asset", "brokerage", map[string]any{
		"parent_id": s.brokerage, "currency": currency, "institution_id": s.institution,
	})
}

func (s brokerageSetup) openCash(t *testing.T, amount int64) {
	t.Helper()

	var accounts struct {
		Items []struct {
			ID         string `json:"id"`
			SystemRole string `json:"system_role"`
		} `json:"items"`
	}
	s.h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &accounts)

	for _, a := range accounts.Items {
		if a.SystemRole == "opening_balances" {
			s.h.Record("2026-10-01", s.h.Posting(s.cash, amount), s.h.Posting(a.ID, -amount))

			return
		}
	}

	t.Fatal("no opening_balances account")
}

func (s brokerageSetup) buy(date string, quantity int64) map[string]any {
	return map[string]any{
		"brokerage_id": s.brokerage, "instrument": "AUVP11", "side": "buy", "date": date,
		"quantity": map[string]any{"amount": quantity, "currency": "AUVP11"}, "unit_price": "10",
	}
}

func (s brokerageSetup) holdings(t *testing.T, instrument string) []accountItem {
	t.Helper()

	var out struct {
		Items []accountItem `json:"items"`
	}
	s.h.MustDo(http.MethodGet, "/api/v1/accounts?limit=200", nil, http.StatusOK, &out)

	var found []accountItem

	for _, a := range out.Items {
		if a.ParentID == s.brokerage && a.Currency == instrument {
			found = append(found, a)
		}
	}

	return found
}

func security(code string) map[string]any {
	return map[string]any{
		"code":           code,
		"type":           "etf",
		"scale":          0,
		"name":           code,
		"quote_currency": "BRL",
		"exchange":       "BVMF",
	}
}

func institutionID(t *testing.T, h *apitest.Harness) string {
	t.Helper()

	return namedInstitution(t, h, "XP")
}

type tradeResult struct {
	Postings []struct {
		AccountID string `json:"account_id"`
		Amount    struct {
			Amount int64 `json:"amount"`
		} `json:"amount"`
	} `json:"postings"`
}

func (r tradeResult) amountOn(accountID string) int64 {
	for _, p := range r.Postings {
		if p.AccountID == accountID {
			return p.Amount.Amount
		}
	}

	return 0
}

func namedInstitution(t *testing.T, h *apitest.Harness, name string) string {
	t.Helper()

	var out struct {
		ID string `json:"id"`
	}
	h.MustDo(
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": name},
		http.StatusCreated,
		&out,
	)

	return out.ID
}

// S681 (BC19): the message of an ambiguous paying account names the close of the cash account
// with no entry, and after that close a trade is paid from the account of the institution.
func TestS681ClosingTheIdleCashEndsTheAmbiguity(t *testing.T) {
	t.Parallel()
	s, checking := newOutsideSetup(t)
	cash := s.child("Cash", string(s.h.Profile.Base))

	r := s.h.Do(http.MethodPost, tradesPath, s.buy("2026-10-05", 10))
	s.h.ExpectProblem(r, http.StatusUnprocessableEntity, "brokerage_cash_ambiguous", "")

	var p struct {
		Detail string `json:"detail"`
	}
	r.Decode(t, &p)

	const want = "the brokerage has several cash accounts; " +
		"name one in cash_account_id, or close the cash account that has no entry"
	if p.Detail != want {
		t.Fatalf("detail = %q, want %q", p.Detail, want)
	}

	s.h.MustDo(
		http.MethodPost,
		"/api/v1/accounts/"+cash+"/close",
		map[string]any{"closed_on": "2026-10-05"},
		http.StatusOK,
		nil,
	)

	var tx tradeResult
	s.h.MustDo(http.MethodPost, tradesPath, s.buy("2026-10-05", 10), http.StatusCreated, &tx)

	if got := tx.amountOn(checking); got != -10000 {
		t.Fatalf("checking posting = %d, want -10000: %+v", got, tx.Postings)
	}
}

package ledger_test

import (
	"encoding/json/v2"
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// brl decodes a Money object in BRL to its amount (ADR 007, C7).
type brl int64

func (m *brl) UnmarshalJSON(b []byte) error {
	var v struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	if v.Currency != "BRL" {
		return fmt.Errorf("currency %q, want BRL", v.Currency)
	}
	*m = brl(v.Amount)
	return nil
}

type statementView struct {
	ID         string `json:"id"`
	Reference  string `json:"reference"`
	DueDate    string `json:"due_date"`
	Opening    brl    `json:"opening"`
	Charges    brl    `json:"charges"`
	Credits    brl    `json:"credits"`
	AmountDue  brl    `json:"amount_due"`
	Payments   brl    `json:"payments"`
	Unpaid     brl    `json:"unpaid"`
	Settled    brl    `json:"settled"`
	Prior      brl    `json:"prior_credits"`
	Early      brl    `json:"early_payments"`
	Billed     brl    `json:"billed_amount"`
	Open       brl    `json:"open_amount"`
	Status     string `json:"status"`
	Reconciled bool   `json:"reconciled"`
}

func statements(t testing.TB, h *apitest.Harness, card string) map[string]statementView {
	t.Helper()
	var out struct {
		Items []statementView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/statements?from=2026-01&to=2027-12", nil, http.StatusOK, &out)
	m := map[string]statementView{}
	for _, s := range out.Items {
		m[s.Reference] = s
	}
	return m
}

type cardSetup struct {
	h                    *apitest.Harness
	card, food, checking string
}

func newCardSetup(t *testing.T, today string) cardSetup {
	h := apitest.New(t, apitest.Today(today))
	return cardSetup{h: h, card: h.Card("Itaú Visa", 3, 10, "next"), food: h.Account("Food", "expense", "", nil), checking: h.Account("Nubank", "asset", "checking", nil)}
}

func (c cardSetup) purchase(date string, amount int64) string {
	return c.h.Record(date, apitest.Posting(c.card, -amount), apitest.Posting(c.food, amount))
}

func (c cardSetup) pay(date string, amount int64) {
	c.h.Record(date, apitest.Posting(c.card, amount), apitest.Posting(c.checking, -amount))
}

func TestStatementFullPayment(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 100000)
	c.purchase("2026-10-20", 50000)
	c.pay("2026-11-10", 150000)

	// A89: the payment of 2026-11-10 is made in the cycle of 2026-12 and settles 2026-11.
	ss := statements(t, c.h, c.card)
	if s := ss["2026-11"]; s.AmountDue != 150000 || s.Payments != 0 || s.Settled != 150000 || s.Unpaid != 0 || s.Status != "paid" || s.DueDate != "2026-11-10" {
		t.Fatalf("2026-11 = %+v", s)
	}
	if s := ss["2026-12"]; s.Payments != 150000 || s.Early != 0 || s.AmountDue != 0 {
		t.Fatalf("2026-12 = %+v", s)
	}
}

func TestStatementPartialPaymentCarries(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	c.pay("2026-11-10", 100000)
	c.purchase("2026-11-05", 6250)

	ss := statements(t, c.h, c.card)
	if s := ss["2026-11"]; s.Status != "overdue" || s.Unpaid != 50000 {
		t.Fatalf("2026-11 = %+v", s)
	}
	if s := ss["2026-12"]; s.Opening != 150000 || s.AmountDue != 56250 || s.Status != "open" {
		t.Fatalf("2026-12 = %+v", s)
	}
}

// S180 (A138): statement 2026-11 closes on 2026-11-03 and is due on 2026-11-10. The open
// statement 2026-12 leaves out its unpaid amount until it is overdue.
func TestStatementOpenAmount_S180(t *testing.T) {
	t.Parallel()
	for _, tt := range []struct {
		today string
		want  brl
	}{{"2026-11-05", 35372}, {"2026-11-11", 159237}} {
		c := newCardSetup(t, tt.today)
		c.purchase("2026-10-14", 123865)
		c.purchase("2026-11-04", 35372)

		got := statements(t, c.h, c.card)["2026-12"]

		if got.Open != tt.want || got.AmountDue != 159237 {
			t.Errorf("on %s: open_amount = %d, amount_due = %d, want %d and 159237", tt.today, got.Open, got.AmountDue, tt.want)
		}
	}
}

func TestStatementOverpaymentBecomesCredit(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	c.pay("2026-11-10", 160000)
	c.purchase("2026-11-05", 1000)

	ss := statements(t, c.h, c.card)
	if s := ss["2026-11"]; s.Status != "paid" || s.Unpaid != 0 {
		t.Fatalf("2026-11 = %+v", s)
	}
	if s := ss["2026-12"]; s.Opening != 150000 || s.AmountDue != -9000 || s.Early != 10000 {
		t.Fatalf("2026-12 = %+v", s)
	}
}

func TestEmptyStatementAfterVoid(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	id := c.purchase("2026-10-14", 1000)
	c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+id+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)

	if s := statements(t, c.h, c.card)["2026-11"]; s.AmountDue != 0 || s.Charges != 0 || s.Status != "paid" {
		t.Fatalf("statement = %+v", s)
	}
}

func TestStatementDetail(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 23000)
	c.purchase("2026-10-20", 1000)
	id := statements(t, c.h, c.card)["2026-11"].ID

	var detail struct {
		AmountDue brl `json:"amount_due"`
		Postings  []struct {
			TransactionID string `json:"transaction_id"`
			Date          string `json:"date"`
			Role          string `json:"card_role"`
			Amount        struct {
				Amount int64 `json:"amount"`
			} `json:"amount"`
		} `json:"postings"`
	}
	c.h.MustDo(http.MethodGet, "/api/v1/statements/"+id, nil, http.StatusOK, &detail)
	if detail.AmountDue != 24000 || len(detail.Postings) != 2 || detail.Postings[0].Date != "2026-10-14" || detail.Postings[0].Amount.Amount != -23000 {
		t.Fatalf("detail = %+v", detail)
	}
	c.h.ExpectProblem(c.h.Do(http.MethodGet, "/api/v1/statements/00000000-0000-7000-8000-000000000000", nil), http.StatusNotFound, "not_found", "")
}

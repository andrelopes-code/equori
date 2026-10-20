package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S84: a refund received after the closing of 2026-11 and before its payment settles it
// with the payment; the next statement reports it apart from its own credits and shows the
// payment made before its closing as an early payment (A89).
func TestS84RefundBeforePayment(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-12-20")
	refunds := c.h.Account("Refunds", "income", "", nil)
	c.purchase("2026-10-14", 103475)
	c.h.Record("2026-11-05", apitest.Posting(c.card, 7290), apitest.Posting(refunds, -7290))
	c.pay("2026-11-08", 96185)
	c.pay("2026-11-20", 100000)
	c.purchase("2026-11-25", 228132)
	c.h.Record("2026-11-26", apitest.Posting(c.card, 49667), apitest.Posting(refunds, -49667))
	c.pay("2026-12-09", 78465)

	ss := statements(t, c.h, c.card)
	if s := ss["2026-11"]; s.AmountDue != 103475 || s.Settled != 103475 || s.Unpaid != 0 || s.Status != "paid" {
		t.Fatalf("2026-11 = %+v", s)
	}
	if s := ss["2026-12"]; s.Opening != 103475 || s.Charges != 228132 || s.Credits != 56957 || s.Prior != 7290 ||
		s.Payments != 196185 || s.Early != 100000 || s.AmountDue != 78465 || s.Billed != 178465 || s.Status != "paid" {
		t.Fatalf("2026-12 = %+v", s)
	}
	var detail statementView
	c.h.MustDo(http.MethodGet, "/api/v1/statements/"+ss["2026-12"].ID, nil, http.StatusOK, &detail)
	if detail.Billed != 178465 || detail.Early != 100000 || detail.Prior != 7290 || detail.Settled != 78465 {
		t.Fatalf("2026-12 detail = %+v", detail)
	}
}

// S85 (S10 restated): an early payment lowers the amount due and is shown apart; a partial
// payment leaves the rest unpaid and in the next opening.
func TestS85EarlyAndPartialPayments(t *testing.T) {
	t.Parallel()
	t.Run("early", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-12")
		c.purchase("2026-10-14", 150000)
		c.pay("2026-10-28", 30000)
		c.pay("2026-11-10", 120000)
		s := statements(t, c.h, c.card)["2026-11"]
		if s.AmountDue != 120000 || s.Billed != 150000 || s.Early != 30000 || s.Status != "paid" {
			t.Fatalf("2026-11 = %+v", s)
		}
	})
	t.Run("partial", func(t *testing.T) {
		c := newCardSetup(t, "2026-11-12")
		c.purchase("2026-10-14", 150000)
		c.pay("2026-11-10", 100000)
		ss := statements(t, c.h, c.card)
		if s := ss["2026-11"]; s.Unpaid != 50000 || s.Status != "overdue" {
			t.Fatalf("2026-11 = %+v", s)
		}
		if s := ss["2026-12"]; s.Opening != 150000 || s.Payments != 100000 || s.AmountDue != 50000 {
			t.Fatalf("2026-12 = %+v", s)
		}
	})
}

// S82 (A85, A86): the owner's facts re-date a statement; a purchase recorded by date before
// moves with the new closing date, and later purchases follow the stored dates.
func TestS82ManualPurchaseAfterRedating(t *testing.T) {
	t.Parallel()
	c := newCardSetup(t, "2026-11-12")
	before := c.purchase("2026-11-02", 1000)
	if got := c.h.Transaction(before).Postings[0].Statement; got != "2026-11" {
		t.Fatalf("purchase of 2026-11-02 before the facts billed on %s", got)
	}
	c.h.MustDo(http.MethodPut, "/api/v1/statements/"+c.statementID(t, "2026-11")+"/facts",
		map[string]any{"closing_date": "2026-11-01", "due_date": "2026-11-10", "total": apitest.BRL(0)}, http.StatusOK, nil)

	if got := c.h.Transaction(before).Postings[0].Statement; got != "2026-12" {
		t.Fatalf("purchase of 2026-11-02 after the facts billed on %s", got)
	}
	for date, want := range map[string]string{"2026-10-31": "2026-11", "2026-11-01": "2026-12"} {
		if got := c.h.Transaction(c.purchase(date, 500)).Postings[0].Statement; got != want {
			t.Errorf("purchase of %s billed on %s, want %s", date, got, want)
		}
	}
	ss := statements(t, c.h, c.card)
	if s := ss["2026-11"]; s.Charges != 500 {
		t.Fatalf("2026-11 = %+v", s)
	}

	c.h.MustDo(http.MethodDelete, "/api/v1/statements/"+c.statementID(t, "2026-11")+"/facts", nil, http.StatusNoContent, nil)
	if got := c.h.Transaction(before).Postings[0].Statement; got != "2026-11" {
		t.Fatalf("purchase of 2026-11-02 after removing the facts billed on %s", got)
	}
}

// S81 (A87): a card that closes 7 days before its nominal due date, on the preceding
// business day, and falls due on day 5 or the following business day.
func TestS81ClosingBeforeDue(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-12"))
	card := h.Account("Nubank Gold", "liability", "credit_card", nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules", map[string]any{
		"effective_from": "2026-01", "due_day": 5, "due_date_adjustment": "following", "calendar": "br_banking",
		"closing_mode": "before_due", "closing_days_before_due": 7, "closing_adjustment": "preceding",
	}, http.StatusCreated, nil)
	food := h.Account("Food", "expense", "", nil)
	purchase := func(date string) string {
		return h.Transaction(h.Record(date, apitest.Posting(card, -1000), apitest.Posting(food, 1000))).Postings[0].Statement
	}
	for _, date := range []string{"2026-07-20", "2026-08-10", "2026-09-10", "2026-10-10"} {
		purchase(date)
	}
	if got := purchase("2026-08-28"); got != "2026-10" {
		t.Fatalf("purchase of 2026-08-28 billed on %s, want 2026-10", got)
	}
	var out struct {
		Items []struct {
			Reference   string `json:"reference"`
			ClosingDate string `json:"closing_date"`
			DueDate     string `json:"due_date"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/statements?from=2026-08&to=2026-11", nil, http.StatusOK, &out)
	want := map[string][2]string{
		"2026-08": {"2026-07-29", "2026-08-05"}, "2026-09": {"2026-08-28", "2026-09-08"},
		"2026-10": {"2026-09-28", "2026-10-05"}, "2026-11": {"2026-10-29", "2026-11-05"},
	}
	if len(out.Items) != len(want) {
		t.Fatalf("statements = %+v", out.Items)
	}
	for _, s := range out.Items {
		if w := want[s.Reference]; s.ClosingDate != w[0] || s.DueDate != w[1] {
			t.Errorf("%s closes %s, due %s; want %v", s.Reference, s.ClosingDate, s.DueDate, w)
		}
	}
}

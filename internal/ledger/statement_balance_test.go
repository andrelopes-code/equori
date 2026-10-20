package ledger_test

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// S84: a refund received after the closing of 2026-11 and before its payment settles it
// with the payment; the next statement reports it apart from its own credits and shows the
// payment made before its closing as an early payment (A89).
func TestS84RefundBeforePayment(t *testing.T) {
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
}

// S85 (S10 restated): an early payment lowers the amount due and is shown apart; a partial
// payment leaves the rest unpaid and in the next opening.
func TestS85EarlyAndPartialPayments(t *testing.T) {
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

package ingestion_test

import (
	"fmt"
	"testing"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
)

// parcel is installment k of n of a purchase on 2026-08-24 described as store.
func parcel(store string, k, n int, date string, amount pluggy.Decimal, status string, billID *string) pluggy.Transaction {
	t := cardLine(fmt.Sprintf("%s-%d", store, k), date, amount, status, billID)
	t.Description = fmt.Sprintf("%s %d/%d", store, k, n)
	if t.CreditCardMetadata == nil {
		t.CreditCardMetadata = &pluggy.CardMetadata{}
	}
	t.CreditCardMetadata.InstallmentNumber, t.CreditCardMetadata.TotalInstallments = k, n
	t.CreditCardMetadata.PurchaseDate = new("2026-08-24T00:00:00.000Z")
	return t
}

// installments lists the card's plan installments as number:amount:statement:status.
func (f syncFixture) installments(card string) []string {
	f.h.T().Helper()
	rows, err := f.h.Pool.Query(f.h.T().Context(), `SELECT p.installment_number, p.amount, to_char(s.reference_month, 'YYYY-MM'), p.status
		FROM ledger_posting p JOIN ledger_statement s ON s.id = p.statement_id
		WHERE p.account_id = $1 AND p.installment_plan_id IS NOT NULL ORDER BY p.installment_number`, card)
	if err != nil {
		f.h.T().Fatal(err)
	}
	defer rows.Close()
	var got []string
	for rows.Next() {
		var k int
		var amount int64
		var ref, status string
		if err := rows.Scan(&k, &amount, &ref, &status); err != nil {
			f.h.T().Fatal(err)
		}
		got = append(got, fmt.Sprintf("%d:%d:%s:%s", k, amount, ref, status))
	}
	return got
}

// purchaseTotal is the sum of the purchase's postings outside the card.
func (f syncFixture) purchaseTotal(card string) int64 {
	f.h.T().Helper()
	return int64(f.count(`SELECT coalesce(sum(p.amount), 0)::int FROM ledger_posting p
		JOIN ledger_installment_plan pl ON pl.origin_transaction_id = p.transaction_id
		WHERE pl.account_id = $1 AND p.account_id <> $1`, card))
}

func newInstallmentSync(t *testing.T) (syncFixture, string) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapCard(card, "2026-08-01")
	for _, due := range []string{"2026-09-10", "2026-10-10", "2026-11-10"} {
		f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-" + due, DueDate: due + "T00:00:00.000Z", TotalAmount: "0"})
	}
	return f, card
}

// S86: the installment that carries the rounding remainder confirms its installment with its
// own amount, whichever line came first (A90, 5.2.5).
func TestS86InstallmentRemainder(t *testing.T) {
	f, card := newInstallmentSync(t)
	f.line(pluggy.SubtypeCard, parcel("CEA", 2, 3, "2026-09-24", "59.99", "POSTED", new("bill-2026-10-10")))
	f.line(pluggy.SubtypeCard, parcel("CEA", 1, 3, "2026-08-24", "60.01", "POSTED", new("bill-2026-09-10")))
	f.line(pluggy.SubtypeCard, parcel("CEA", 3, 3, "2026-10-24", "59.99", "PENDING", nil))
	f.sync()

	want := []string{"1:-6001:2026-09:cleared", "2:-5999:2026-10:cleared", "3:-5999:2026-11:pending"}
	if got := f.installments(card); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("installments = %v, want %v", got, want)
	}
	if got := f.purchaseTotal(card); got != 17999 {
		t.Fatalf("purchase total = %d", got)
	}
	if b := f.batches(card)[0]; b.Counts.NeedsReview != 0 || b.Counts.Created != 1 || b.Counts.Matched != 2 {
		t.Fatalf("batch = %+v", b)
	}
}

// S87 (A90): an installment line on a bill moves its installment to that bill's statement.
func TestS87InstallmentOnTheInstitutionBill(t *testing.T) {
	f, card := newInstallmentSync(t)
	f.line(pluggy.SubtypeCard, parcel("SHOPEE", 1, 2, "2026-08-24", "86.14", "POSTED", new("bill-2026-09-10")))
	f.sync()
	if got := f.installments(card); fmt.Sprint(got) != "[1:-8614:2026-09:cleared 2:-8614:2026-10:cleared]" {
		t.Fatalf("projected installments = %v", got)
	}

	f.line(pluggy.SubtypeCard, parcel("SHOPEE", 2, 2, "2026-10-24", "86.13", "POSTED", new("bill-2026-11-10")))
	f.sync()
	if got := f.installments(card); fmt.Sprint(got) != "[1:-8614:2026-09:cleared 2:-8613:2026-11:cleared]" {
		t.Fatalf("installments = %v", got)
	}
	if got := f.purchaseTotal(card); got != 17227 {
		t.Fatalf("purchase total = %d", got)
	}
}

// A90: a plan created from installment 2 takes the purchase total the source reports, split
// with the remainder on installment 1.
func TestInstallmentPlanFromTheReportedTotal(t *testing.T) {
	f, card := newInstallmentSync(t)
	line := parcel("CEA", 2, 3, "2026-09-24", "59.99", "POSTED", new("bill-2026-10-10"))
	line.CreditCardMetadata.TotalAmount = "179.99"
	f.line(pluggy.SubtypeCard, line)
	f.sync()
	want := []string{"1:-6001:2026-09:cleared", "2:-5999:2026-10:cleared", "3:-5999:2026-11:cleared"}
	if got := f.installments(card); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("installments = %v, want %v", got, want)
	}
}

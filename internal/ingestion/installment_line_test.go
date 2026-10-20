package ingestion_test

import (
	"fmt"
	"net/http"
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

// newInstallmentSync has a card with the bills due on dues; a bill is a statement the
// institution reported, which a pending line never stays on (A90).
func newInstallmentSync(t *testing.T, dues ...string) (syncFixture, string) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapCard(card, "2026-08-01")
	for _, due := range dues {
		f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-" + due, DueDate: due + "T00:00:00.000Z", TotalAmount: "0"})
	}
	return f, card
}

// S86: the installment that carries the rounding remainder confirms its installment with its
// own amount, whichever line came first (A90, 5.2.5).
func TestS86InstallmentRemainder(t *testing.T) {
	t.Parallel()
	f, card := newInstallmentSync(t, "2026-09-10", "2026-10-10")
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
	t.Parallel()
	f, card := newInstallmentSync(t, "2026-09-10", "2026-11-10")
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
	t.Parallel()
	f, card := newInstallmentSync(t, "2026-10-10")
	line := parcel("CEA", 2, 3, "2026-09-24", "59.99", "POSTED", new("bill-2026-10-10"))
	line.CreditCardMetadata.TotalAmount = "179.99"
	f.line(pluggy.SubtypeCard, line)
	f.sync()
	want := []string{"1:-6001:2026-09:cleared", "2:-5999:2026-10:cleared", "3:-5999:2026-11:cleared"}
	if got := f.installments(card); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("installments = %v, want %v", got, want)
	}
}

// A90: a sync offers again an installment line waiting for review: refused while its
// installment was reconciled, it confirms the installment once the account is unlocked.
func TestSyncRetriesAnInstallmentLineInReview(t *testing.T) {
	t.Parallel()
	f, card := newInstallmentSync(t)
	f.line(pluggy.SubtypeCard, parcel("LOJA", 1, 3, "2026-08-24", "100.00", "POSTED", nil))
	f.sync()
	var out struct {
		Items []struct {
			ID        string `json:"id"`
			Reference string `json:"reference"`
			AmountDue struct {
				Amount int64 `json:"amount"`
			} `json:"amount_due"`
		} `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/statements?from=2026-10&to=2026-10", nil, http.StatusOK, &out)
	f.h.MustDo(http.MethodPost, "/api/v1/statements/"+out.Items[0].ID+"/reconcile",
		map[string]any{"amount_due": map[string]any{"amount": out.Items[0].AmountDue.Amount, "currency": "BRL"}}, http.StatusOK, nil)

	f.line(pluggy.SubtypeCard, parcel("LOJA", 2, 3, "2026-10-20", "101.00", "POSTED", nil))
	f.sync()
	if state, _ := f.recordOf("LOJA-2"); state != "needs_review" {
		t.Fatalf("line of a reconciled installment = %s", state)
	}

	f.h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/unlock", map[string]any{"from": "2026-09-01"}, http.StatusOK, nil)
	f.sync()
	if state, _ := f.recordOf("LOJA-2"); state != "matched" {
		t.Fatalf("retried line = %s", state)
	}
	if got := f.installments(card); got[1] != "2:-10100:2026-10:cleared" {
		t.Fatalf("installments = %v", got)
	}
	var review int
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT coalesce(sum(needs_review), 0)::int FROM ingestion_batch WHERE account_id = $1`, card).Scan(&review); err != nil {
		t.Fatal(err)
	}
	if review != 0 {
		t.Fatalf("batches still count %d lines in review", review)
	}
}

// A97: an installment that a reported bill closed without was not billed; it stays on its
// statement, which reports the difference and is not reconciled, instead of moving to the
// next statement as a pending purchase does (A90).
func TestUnbilledInstallmentStaysOnTheReportedBill(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapCard(card, "2026-08-01")
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-sep", DueDate: "2026-09-10T00:00:00.000Z", TotalAmount: "0"})
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-oct", DueDate: "2026-10-10T00:00:00.000Z", TotalAmount: "10.00"})
	f.line(pluggy.SubtypeCard, parcel("SHOPEE", 1, 2, "2026-08-24", "86.14", "POSTED", new("bill-sep")))
	refund := cardLine("refund-1", "2026-08-26", "-86.14", "POSTED", new("bill-sep"))
	refund.OperationType = new("ESTORNO")
	f.line(pluggy.SubtypeCard, refund)
	f.line(pluggy.SubtypeCard, cardLine("charge-oct", "2026-09-15", "10.00", "POSTED", new("bill-oct")))
	f.line(pluggy.SubtypeCard, parcel("SHOPEE", 2, 2, "2026-09-24", "86.13", "PENDING", nil))
	f.sync()

	want := []string{"1:-8614:2026-09:reconciled", "2:-8613:2026-10:pending"}
	if got := f.installments(card); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("installments = %v, want %v", got, want)
	}
	if s := f.statement(card, "2026-10"); s.Difference == nil || s.Difference.Amount != 8613 || s.Reconciled {
		t.Fatalf("2026-10 = %+v (difference %+v)", s, s.Difference)
	}
}

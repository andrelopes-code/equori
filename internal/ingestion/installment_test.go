package ingestion_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
)

// installmentLine is installment k of 6 of a 600.00 purchase on 2026-08-14; banks repeat
// the installment in the description.
func installmentLine(k int, date string, amount pluggy.Decimal, billID *string) pluggy.Transaction {
	t := cardLine(fmt.Sprintf("inst-%d", k), date, amount, "POSTED", billID)
	t.Description = fmt.Sprintf("LOJA EXEMPLO %02d/06", k)
	if t.CreditCardMetadata == nil {
		t.CreditCardMetadata = &pluggy.CardMetadata{}
	}
	t.CreditCardMetadata.InstallmentNumber, t.CreditCardMetadata.TotalInstallments = k, 6
	t.CreditCardMetadata.PurchaseDate = new("2026-08-14T00:00:00.000Z")
	return t
}

func (f syncFixture) mapCard(card, from string) {
	f.h.T().Helper()
	r := f.mapAccount(f.h.Client, f.conn.ID, externalAccount(f.conn, pluggy.SubtypeCard).ID, map[string]any{"account_id": card, "sync_from": from})
	if r.Status != http.StatusOK {
		f.h.T().Fatalf("map status %d: %s", r.Status, r.Body)
	}
}

// installmentOf returns the plan installment the record of a line confirms, 0 for none.
func (f syncFixture) installmentOf(externalID string) int {
	f.h.T().Helper()
	var n int
	err := f.h.Pool.QueryRow(f.h.T().Context(), `SELECT coalesce(max(p.installment_number), 0) FROM ledger_posting p
		JOIN ingestion_external_record r ON p.external_record_id = r.id WHERE r.external_id = $1`, externalID).Scan(&n)
	if err != nil {
		f.h.T().Fatal(err)
	}
	return n
}

// plan checks the single installment plan of the card: six installments of 100.00 from
// statement 2026-09, one per month.
func (f syncFixture) plan(card string) {
	f.h.T().Helper()
	rows, err := f.h.Pool.Query(f.h.T().Context(), `SELECT p.installment_number, p.amount, to_char(s.reference_month, 'YYYY-MM')
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
		var ref string
		if err := rows.Scan(&k, &amount, &ref); err != nil {
			f.h.T().Fatal(err)
		}
		got = append(got, fmt.Sprintf("%d:%d:%s", k, amount, ref))
	}
	want := []string{"1:-10000:2026-09", "2:-10000:2026-10", "3:-10000:2026-11", "4:-10000:2026-12", "5:-10000:2027-01", "6:-10000:2027-02"}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		f.h.T().Fatalf("installments = %v, want %v", got, want)
	}
	if n := f.count(`SELECT count(*) FROM ledger_installment_plan WHERE account_id = $1`, card); n != 1 {
		f.h.T().Fatalf("plans = %d", n)
	}
}

// S54, bank pattern "all at once": every installment arrives on the first sync.
func TestInstallmentsAllAtOnce(t *testing.T) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapCard(card, "2026-08-01")
	for k := 1; k <= 6; k++ {
		f.line(pluggy.SubtypeCard, installmentLine(k, "2026-08-14", "100.00", nil))
	}
	transactions := transactionCount(t, f.h)
	f.sync()
	f.plan(card)
	for k := 1; k <= 6; k++ {
		if got := f.installmentOf(fmt.Sprintf("inst-%d", k)); got != k {
			t.Fatalf("inst-%d confirms installment %d", k, got)
		}
	}
	if got := transactionCount(t, f.h); got != transactions+1 {
		t.Fatalf("transactions %d → %d", transactions, got)
	}
	if b := f.batches(card)[0]; b.Counts.Created != 1 || b.Counts.Matched != 5 || b.Counts.NeedsReview != 0 {
		t.Fatalf("batch = %+v", b)
	}
}

// S54, bank pattern "month by month": each month adds its installment.
func TestInstallmentsMonthByMonth(t *testing.T) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapCard(card, "2026-08-01")
	f.line(pluggy.SubtypeCard, installmentLine(1, "2026-08-14", "100.00", nil))
	f.line(pluggy.SubtypeCard, installmentLine(2, "2026-09-14", "100.00", nil))
	f.line(pluggy.SubtypeCard, installmentLine(3, "2026-10-14", "100.00", nil))
	f.sync()
	transactions := transactionCount(t, f.h)

	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-dec", DueDate: "2026-12-10T00:00:00.000Z", TotalAmount: "100.00"})
	f.line(pluggy.SubtypeCard, installmentLine(4, "2026-11-10", "100.00", new("bill-dec")))
	f.sync()
	f.plan(card)
	for k := 1; k <= 4; k++ {
		if got := f.installmentOf(fmt.Sprintf("inst-%d", k)); got != k {
			t.Fatalf("inst-%d confirms installment %d", k, got)
		}
	}
	if got := transactionCount(t, f.h); got != transactions {
		t.Fatalf("transactions %d → %d", transactions, got)
	}
}

// S54, bank pattern "current only": installment 3/6 on the bill due 2026-11-10 creates the
// plan from statement 2026-09; the next month only 4/6 is returned.
func TestInstallmentsCurrentOnly(t *testing.T) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapCard(card, "2026-10-01")
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-nov", DueDate: "2026-11-10T00:00:00.000Z", TotalAmount: "100.00"})
	f.line(pluggy.SubtypeCard, installmentLine(3, "2026-10-14", "100.00", new("bill-nov")))
	f.sync()
	f.plan(card)
	if got := f.installmentOf("inst-3"); got != 3 {
		t.Fatalf("inst-3 confirms installment %d", got)
	}
	transactions := transactionCount(t, f.h)

	f.p.RemoveTransaction(nubankItem+"-card", "inst-3")
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-dec", DueDate: "2026-12-10T00:00:00.000Z", TotalAmount: "100.00"})
	f.line(pluggy.SubtypeCard, installmentLine(4, "2026-11-10", "100.00", new("bill-dec")))
	f.sync()
	if got := f.installmentOf("inst-4"); got != 4 {
		t.Fatalf("inst-4 confirms installment %d", got)
	}
	if got := transactionCount(t, f.h); got != transactions {
		t.Fatalf("transactions %d → %d", transactions, got)
	}
	f.plan(card)
}

// A90 (replaces A40's review of a different amount): a line sets the amount of the
// installment it confirms, and the purchase follows.
func TestInstallmentLineSetsItsAmount(t *testing.T) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapCard(card, "2026-08-01")
	f.line(pluggy.SubtypeCard, installmentLine(1, "2026-08-14", "100.00", nil))
	f.line(pluggy.SubtypeCard, installmentLine(2, "2026-09-14", "101.00", nil))
	f.sync()
	if state, _ := f.recordOf("inst-2"); state != "matched" || f.installmentOf("inst-2") != 2 {
		t.Fatalf("inst-2 = %s on installment %d", state, f.installmentOf("inst-2"))
	}
	if got := f.installments(card); got[1] != "2:-10100:2026-10:cleared" || got[2] != "3:-10000:2026-11:cleared" {
		t.Fatalf("installments = %v", got)
	}
	if got := f.purchaseTotal(card); got != 60100 {
		t.Fatalf("purchase total = %d", got)
	}
}

// P6 Review Focus 5: a line of a plan cancelled in the ledger waits for review and the
// batch completes.
func TestInstallmentOfACancelledPlan(t *testing.T) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapCard(card, "2026-08-01")
	f.line(pluggy.SubtypeCard, installmentLine(1, "2026-08-14", "100.00", nil))
	f.sync()
	var planID string
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT id::text FROM ledger_installment_plan WHERE account_id = $1`, card).Scan(&planID); err != nil {
		t.Fatal(err)
	}
	f.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+planID+"/cancellation", map[string]any{"date": "2026-11-12"}, http.StatusCreated, nil)

	// Inside the 30-day window of the next sync.
	f.line(pluggy.SubtypeCard, installmentLine(2, "2026-10-20", "100.00", nil))
	f.sync()
	if state, _ := f.recordOf("inst-2"); state != "needs_review" {
		t.Fatalf("inst-2 = %s", state)
	}
	if b := f.batches(card)[0]; b.Counts.Received != 1 || b.Counts.NeedsReview != 1 {
		t.Fatalf("batch = %+v", b)
	}
}

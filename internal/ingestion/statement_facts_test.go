package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
)

type factView struct {
	Reference   string `json:"reference"`
	ClosingDate string `json:"closing_date"`
	DueDate     string `json:"due_date"`
	Reconciled  bool   `json:"reconciled"`
	Institution *struct {
		Source      string `json:"source"`
		ClosingDate string `json:"closing_date"`
		Total       struct {
			Amount int64 `json:"amount"`
		} `json:"total"`
	} `json:"institution"`
	Difference *struct {
		Amount int64 `json:"amount"`
	} `json:"amount_difference"`
}

func (f syncFixture) statement(card, ref string) factView {
	f.h.T().Helper()
	var out struct {
		Items []factView `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+card+"/statements?from="+ref+"&to="+ref, nil, http.StatusOK, &out)
	if len(out.Items) != 1 {
		f.h.T().Fatalf("statements %s = %+v", ref, out.Items)
	}
	return out.Items[0]
}

func cardWithBill(t *testing.T, bill pluggy.Bill) (syncFixture, string) {
	f := newSyncFixture(t)
	card := f.h.Card("Nubank card", 3, 10, "next")
	f.mapTo(pluggy.SubtypeCard, card)
	f.p.AddBill(nubankItem+"-card", bill)
	return f, card
}

// S80 (A85, A86, A92): a bill's closing date, due date and total are the statement's facts;
// the statement takes the dates and, with no difference, is reconciled by the sync.
func TestS80StatementFactsFromBill(t *testing.T) {
	f, card := cardWithBill(t, pluggy.Bill{ID: "bill-nov", DueDate: "2026-11-10T00:00:00.000Z", BillClosingDate: new("2026-11-02T00:00:00.000Z"), TotalAmount: "230.00"})
	f.line(pluggy.SubtypeCard, cardLine("charge-1", "2026-10-20", "230.00", "POSTED", new("bill-nov")))
	f.sync()

	s := f.statement(card, "2026-11")
	if s.ClosingDate != "2026-11-02" || s.DueDate != "2026-11-10" || s.Institution == nil || s.Institution.Source != "aggregator" ||
		s.Institution.Total.Amount != 23000 || s.Difference == nil || s.Difference.Amount != 0 || !s.Reconciled {
		t.Fatalf("statement = %+v (institution %+v, difference %+v)", s, s.Institution, s.Difference)
	}
}

// A92: a total that differs from the derived amount due is reported and not reconciled.
func TestStatementFactsReportADifference(t *testing.T) {
	f, card := cardWithBill(t, pluggy.Bill{ID: "bill-nov", DueDate: "2026-11-10T00:00:00.000Z", TotalAmount: "240.00"})
	f.line(pluggy.SubtypeCard, cardLine("charge-1", "2026-10-20", "230.00", "POSTED", new("bill-nov")))
	f.sync()

	s := f.statement(card, "2026-11")
	if s.ClosingDate != "2026-11-03" || s.Difference == nil || s.Difference.Amount != -1000 || s.Reconciled {
		t.Fatalf("statement = %+v (difference %+v)", s, s.Difference)
	}
}

// A90: a pending line is never billed on a statement the institution reported; it moves to
// the first statement without facts.
func TestPendingLineLeavesAReportedStatement(t *testing.T) {
	f, card := cardWithBill(t, pluggy.Bill{ID: "bill-nov", DueDate: "2026-11-10T00:00:00.000Z", BillClosingDate: new("2026-11-02T00:00:00.000Z"), TotalAmount: "230.00"})
	f.line(pluggy.SubtypeCard, cardLine("charge-1", "2026-10-20", "230.00", "POSTED", new("bill-nov")))
	f.line(pluggy.SubtypeCard, cardLine("pending-1", "2026-10-25", "86.13", "PENDING", nil))
	f.sync()

	_, tx := f.recordOf("pending-1")
	if p := f.cardPosting(tx, card); p.Statement != "2026-12" || p.Status != "pending" {
		t.Fatalf("pending posting = %+v", p)
	}
	if s := f.statement(card, "2026-11"); s.Difference == nil || s.Difference.Amount != 0 {
		t.Fatalf("2026-11 difference = %+v", s.Difference)
	}
}

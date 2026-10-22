package ingestion_test

import (
	"net/http"
	"testing"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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

// A86, A87: a reported closing date takes the rule's closing adjustment: the institution
// reports a Saturday and closes on the Friday before.
func TestReportedClosingTakesTheRuleShift(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	card := f.h.Account("Nubank Gold", "liability", "credit_card", nil)
	f.h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules", map[string]any{
		"effective_from": "2026-01", "due_day": 5, "closing_mode": "before_due", "closing_days_before_due": 7,
		"closing_adjustment": "preceding",
	}, http.StatusCreated, nil)
	r := f.mapAccount(f.h.Client, f.conn.ID, externalAccount(f.conn, pluggy.SubtypeCard).ID, map[string]any{"account_id": card, "sync_from": "2026-08-01"})
	if r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-sep", DueDate: "2026-09-08T00:00:00.000Z", BillClosingDate: new("2026-08-29T00:00:00.000Z"), TotalAmount: "16.61"})
	f.line(pluggy.SubtypeCard, cardLine("uber-1", "2026-08-27", "16.61", "POSTED", new("bill-sep")))
	f.sync()
	if s := f.statement(card, "2026-09"); s.ClosingDate != "2026-08-28" || s.DueDate != "2026-09-08" || s.Institution.ClosingDate != "2026-08-29" {
		t.Fatalf("statement = %+v (institution %+v)", s, s.Institution)
	}
}

// S89 (A93): a card's first sync starts at the cycle that holds sync_from and opens the card
// with the total of the bill before it; the second sync records no second opening.
func TestS89CardSyncStart(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	card := f.h.Account("Nubank Gold", "liability", "credit_card", nil)
	f.h.MustDo(http.MethodPost, "/api/v1/accounts/"+card+"/billing-cycle-rules", map[string]any{
		"effective_from": "2025-01", "due_day": 5, "closing_mode": "before_due", "closing_days_before_due": 7,
		"closing_adjustment": "preceding",
	}, http.StatusCreated, nil)
	r := f.mapAccount(f.h.Client, f.conn.ID, externalAccount(f.conn, pluggy.SubtypeCard).ID, map[string]any{"account_id": card, "sync_from": "2026-07-01"})
	if r.Status != http.StatusOK {
		t.Fatalf("map status %d: %s", r.Status, r.Body)
	}
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-jun", DueDate: "2026-06-05T00:00:00.000Z", BillClosingDate: new("2026-05-29T00:00:00.000Z"), TotalAmount: "724.7593"})
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-jul", DueDate: "2026-07-06T00:00:00.000Z", BillClosingDate: new("2026-06-28T00:00:00.000Z"), TotalAmount: "701.4808"})
	f.p.AddBill(nubankItem+"-card", pluggy.Bill{ID: "bill-aug", DueDate: "2026-08-05T00:00:00.000Z", BillClosingDate: new("2026-07-29T00:00:00.000Z"), TotalAmount: "773.5371"})
	f.line(pluggy.SubtypeCard, cardLine("jul-line", "2026-06-20", "50.00", "POSTED", new("bill-jul")))
	f.line(pluggy.SubtypeCard, cardLine("youtube", "2026-06-30", "26.90", "POSTED", new("bill-aug")))
	f.line(pluggy.SubtypeCard, cardLine("purchase", "2026-07-20", "746.64", "POSTED", new("bill-aug")))
	paid := cardLine("payment", "2026-07-05", "-701.48", "POSTED", new("bill-aug"))
	paid.OperationType = new("PAGAMENTO_FATURA")
	f.line(pluggy.SubtypeCard, paid)
	f.sync()

	if n := f.count(`SELECT count(*) FROM ingestion_external_record WHERE external_id = 'jul-line'`); n != 0 {
		t.Fatalf("a line of the bill before the start was recorded")
	}
	if state, _ := f.recordOf("youtube"); state != "created" {
		t.Fatalf("youtube record = %s", state)
	}
	if s := f.statement(card, "2026-08"); s.Difference == nil || s.Difference.Amount != 0 {
		t.Fatalf("2026-08 = %+v (difference %+v)", s, s.Difference)
	}
	if s := f.statement(card, "2026-07"); s.Institution == nil || s.Difference == nil || s.Difference.Amount != 0 {
		t.Fatalf("2026-07 = %+v (difference %+v)", s, s.Difference)
	}
	openings := `SELECT count(*) FROM ledger_posting p JOIN ledger_account a ON a.id = p.account_id
		JOIN ledger_posting c ON c.transaction_id = p.transaction_id AND c.account_id = $1
		WHERE a.system_role = 'opening_balances'`
	if n := f.count(openings, card); n != 1 {
		t.Fatalf("openings = %d", n)
	}
	f.sync()
	if n := f.count(openings, card); n != 1 {
		t.Fatalf("openings after a second sync = %d", n)
	}
}

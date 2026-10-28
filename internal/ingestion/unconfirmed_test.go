package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

type unconfirmedView struct {
	TransactionID string `json:"transaction_id"`
	Date          string `json:"date"`
	StatementID   string `json:"statement_id"`
	Amount        struct {
		Amount int64 `json:"amount"`
	} `json:"amount"`
}

func (f syncFixture) unconfirmed(account string) []unconfirmedView {
	f.h.T().Helper()
	var out struct {
		Items []unconfirmedView `json:"items"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+account+"/unconfirmed", nil, http.StatusOK, &out)
	return out.Items
}

// S167 (A133): transfers into a reserve that its synced balance confirms are not listed.
func TestS167ReserveTransfersAreConfirmedByBalance(t *testing.T) {
	t.Parallel()
	f, _, cofrinho, algum := reserveTransfers(t)
	f.sync()
	f.h.Restart(apitest.Today("2026-11-30"), apitest.Aggregator("pluggy", f.p.URL()))
	f.p.SetItemUpdatedAt(mercadoPagoItem, "2026-11-30T15:00:00.000Z")
	f.sync()
	for _, reserve := range []string{cofrinho, algum} {
		if got := f.unconfirmed(reserve); len(got) != 0 {
			t.Fatalf("unconfirmed of %s = %+v, want none", reserve, got)
		}
	}
}

// S168 (A133): a manual entry the synced balance confirms is not listed.
func TestS168EntryConfirmedByBalance(t *testing.T) {
	t.Parallel()
	m := newMatching(t, nil)
	m.recordOpeningBalance(m.checking, 286410)
	m.manual("2026-10-05", -3000, "", "Cinema")
	m.sync()
	if as := m.assertions(m.checking); len(as) != 1 || !as[0].Reconciled {
		t.Fatalf("assertions = %+v, want one reconciled", as)
	}
	if got := m.unconfirmed(m.checking); len(got) != 0 {
		t.Fatalf("unconfirmed = %+v, want none", got)
	}
}

// installmentPlanFromLine creates a 6 × 100.00 plan from the line of installment 1 on a card
// closing on day 3, mapped from 2026-08-01.
func installmentPlanFromLine(t *testing.T) (f syncFixture, card, planTx, planID string) {
	t.Helper()
	f = newSyncFixture(t)
	card = f.h.Card("Nubank card", 3, 10, "next")
	f.mapCard(card, "2026-08-01")
	f.line(pluggy.SubtypeCard, installmentLine(1, "2026-08-14", "100.00", nil))
	f.sync()
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT id::text, origin_transaction_id::text FROM ledger_installment_plan WHERE account_id = $1`, card).Scan(&planID, &planTx); err != nil {
		t.Fatal(err)
	}
	return f, card, planTx, planID
}

func (f syncFixture) statementID(card, reference string) string {
	f.h.T().Helper()
	var id string
	if err := f.h.Pool.QueryRow(f.h.T().Context(), `SELECT id::text FROM ledger_statement WHERE account_id = $1 AND reference_month = $2::date`, card, reference).Scan(&id); err != nil {
		f.h.T().Fatal(err)
	}
	return id
}

// S169 (A133): an installment is expected at its statement's closing.
func TestS169InstallmentDueAtItsStatementClosing(t *testing.T) {
	t.Parallel()
	f, card, planTx, _ := installmentPlanFromLine(t)
	got := f.unconfirmed(card)
	want := unconfirmedView{TransactionID: planTx, Date: "2026-10-03", StatementID: f.statementID(card, "2026-10-01")}
	want.Amount.Amount = -10000
	if len(got) != 1 || got[0] != want {
		t.Fatalf("unconfirmed = %+v, want [%+v]", got, want)
	}
}

// S170 (A133): cancelled installments offset their reversals one to one; the credit of the
// billed installment stays expected as the institution's refund line.
func TestS170CancelledInstallmentsOffsetTheirReversals(t *testing.T) {
	t.Parallel()
	f, card, _, planID := installmentPlanFromLine(t)
	var cancellation struct {
		ID string `json:"id"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/installment-plans/"+planID+"/cancellation", map[string]any{"date": "2026-09-20"}, http.StatusCreated, &cancellation)
	got := f.unconfirmed(card)
	want := unconfirmedView{TransactionID: cancellation.ID, Date: "2026-10-03", StatementID: f.statementID(card, "2026-10-01")}
	want.Amount.Amount = 10000
	if len(got) != 1 || got[0] != want {
		t.Fatalf("unconfirmed = %+v, want [%+v]", got, want)
	}
}

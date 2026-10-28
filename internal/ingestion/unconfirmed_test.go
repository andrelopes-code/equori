package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
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

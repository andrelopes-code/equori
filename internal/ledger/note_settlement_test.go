package ledger_test

import (
	"net/http"
	"testing"
)

type settlementTx struct {
	ID          string       `json:"id"`
	Description string       `json:"description"`
	Postings    []postingOut `json:"postings"`
	Trade       *struct{}    `json:"trade"`
}

// S701 (A272 NS1, NS2): a note against the institution's checking account moves its cash inside
// the brokerage and debits the checking account once, by the note's total.
func TestS701NoteSettlesOnceOnTheBank(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(http.MethodPost, "/api/v1/instruments", security("VALE3", "stock"),
		http.StatusCreated, nil)
	checking := f.h.Account(
		"XP checking",
		"asset",
		"checking",
		map[string]any{"institution_id": f.institution},
	)
	body := f.noteBody("2026-11-10", 251, 0,
		f.noteOrder("buy", "PETR4", 100, "30.00"),
		f.noteOrder("buy", "VALE3", 50, "60.10"),
	)
	body["cash_account_id"] = checking

	var out noteOut
	f.h.MustDo(http.MethodPost, notesPath, body, http.StatusCreated, &out)

	f.expectCash(t, out.Transactions[0], -300125, "2026-11-12")
	f.expectCash(t, out.Transactions[1], -300626, "2026-11-12")

	txs := accountTransactions(t, f, checking)
	if len(txs) != 1 {
		t.Fatalf("checking transactions = %d, want 1 settlement", len(txs))
	}

	s := txs[0]
	if s.Trade != nil || s.Description != "Liquidação da nota de 10/11/2026" {
		t.Fatalf("settlement = %+v", s)
	}

	expectSettlementPosting(t, s, checking, -600751, "2026-11-12")
	expectSettlementPosting(t, s, f.cash, 600751, "2026-11-12")
}

// S703 (A272 NS4): a brokerage without a cash account keeps one cash posting per order on the
// checking account and records no settlement.
func TestS703NoteWithoutBrokerageCashKeepsItsOrders(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/accounts/"+f.cash+"/close",
		map[string]string{"closed_on": "2026-11-01"},
		http.StatusOK,
		nil,
	)
	checking := f.h.Account(
		"XP checking",
		"asset",
		"checking",
		map[string]any{"institution_id": f.institution},
	)
	body := f.noteBody("2026-11-10", 0, 0, f.noteOrder("buy", "PETR4", 100, "30.00"))
	body["cash_account_id"] = checking

	f.h.MustDo(http.MethodPost, notesPath, body, http.StatusCreated, nil)

	txs := accountTransactions(t, f, checking)
	if len(txs) != 1 || txs[0].Trade == nil {
		t.Fatalf("checking transactions = %+v, want the trade only", txs)
	}
}

func accountTransactions(t *testing.T, f investFixture, account string) []settlementTx {
	t.Helper()

	var txs struct {
		Items []settlementTx `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/transactions?account_id="+account+"&limit=100",
		nil,
		http.StatusOK,
		&txs,
	)

	return txs.Items
}

func expectSettlementPosting(
	t *testing.T,
	tx settlementTx,
	account string,
	amount int64,
	settled string,
) {
	t.Helper()

	for _, p := range tx.Postings {
		if p.AccountID != account {
			continue
		}

		if p.Amount["amount"] != float64(amount) || p.SettledOn == nil || *p.SettledOn != settled {
			t.Fatalf("posting of %s = %v settled %v, want %d settled %s",
				account, p.Amount, p.SettledOn, amount, settled)
		}

		return
	}

	t.Fatalf("settlement %s has no posting on %s", tx.ID, account)
}

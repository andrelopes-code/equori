package ledger_test

import (
	"encoding/json/v2"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type transferResult struct {
	Transaction         apitest.TransactionView `json:"transaction"`
	VoidedTransactionID string                  `json:"voided_transaction_id"`
}

func transfer(h *apitest.Harness, id string, version int, account, pairWith string) apitest.Response {
	body := map[string]any{"expected_version": version, "account_id": account}
	if pairWith != "" {
		body["pair_with"] = pairWith
	}
	return h.Do(http.MethodPost, "/api/v1/transactions/"+id+"/transfer", body)
}

func mustTransfer(t *testing.T, h *apitest.Harness, id string, version int, account, pairWith string) transferResult {
	t.Helper()
	r := transfer(h, id, version, account, pairWith)
	if r.Status != http.StatusOK {
		t.Fatalf("transfer status %d: %s", r.Status, r.Body)
	}
	var out transferResult
	r.Decode(t, &out)
	return out
}

// importLine records an imported line and returns its transaction and record ids.
func importLine(t *testing.T, h *apitest.Harness, account, date string, amount int64) (string, uuid.UUID) {
	t.Helper()
	record := uuid.New()
	id, err := h.App.Ledger.RecordImported(t.Context(), h.OwnerID(), record, imported(t, account, date, amount))
	if err != nil {
		t.Fatal(err)
	}
	return id.String(), record
}

func postingOfRecord(t *testing.T, h *apitest.Harness, record uuid.UUID) (transaction, account string) {
	t.Helper()
	if err := h.Pool.QueryRow(t.Context(), `SELECT transaction_id, account_id FROM ledger_posting WHERE external_record_id = $1`, record).Scan(&transaction, &account); err != nil {
		t.Fatal(err)
	}
	return transaction, account
}

func voidReason(t *testing.T, h *apitest.Harness, id string) string {
	t.Helper()
	var reason *string
	if err := h.Pool.QueryRow(t.Context(), `SELECT void_reason FROM ledger_transaction WHERE id = $1`, id).Scan(&reason); err != nil {
		t.Fatal(err)
	}
	if reason == nil {
		return ""
	}
	return *reason
}

func postingOn(v apitest.TransactionView, card string) apitest.PostingView {
	for _, p := range v.Postings {
		if p.AccountID == card {
			return p
		}
	}
	return apitest.PostingView{}
}

// S50: a transfer without a counterpart replaces the category side.
func TestTransferWithoutCounterpart(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	savings := c.h.Account("Savings", "asset", "savings", nil)
	id, record := importLine(t, c.h, c.checking, "2026-11-05", -50000)

	res := mustTransfer(t, c.h, id, 1, savings, "")
	if got := amountsByAccount(res.Transaction); res.Transaction.ID != id || res.Transaction.Version != 2 || len(res.Transaction.Postings) != 2 ||
		got[c.checking] != -50000 || got[savings] != 50000 || res.VoidedTransactionID != "" {
		t.Fatalf("result = %+v", res)
	}
	if tx, account := postingOfRecord(t, c.h, record); tx != id || account != c.checking {
		t.Fatalf("record on %s/%s", tx, account)
	}
	event := events(t, c.h, id)["ledger.transaction_corrected.v1"]
	if len(event) != 1 || !event[0].CategoriesChanged || event[0].CategoryState != "none" || event[0].Version != 2 {
		t.Fatalf("corrected events = %+v", event)
	}
}

// S47: the checking line pairs with the card line; the card line is voided.
func TestTransferPairsImportedCardPayment(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	checkingTx, checkingRecord := importLine(t, c.h, c.checking, "2026-11-10", -150000)
	cardTx, cardRecord := importLine(t, c.h, c.card, "2026-11-11", 150000)

	res := mustTransfer(t, c.h, checkingTx, 1, c.card, "")
	if res.Transaction.ID != checkingTx || res.VoidedTransactionID != cardTx || len(res.Transaction.Postings) != 2 {
		t.Fatalf("result = %+v", res)
	}
	if p := postingOn(res.Transaction, c.card); p.Amount.Amount != 150000 || p.CardRole != "payment" || p.Statement != "2026-11" {
		t.Fatalf("card posting = %+v", p)
	}
	if reason := voidReason(t, c.h, cardTx); reason != "paired with "+checkingTx {
		t.Fatalf("void reason = %q", reason)
	}
	for record, account := range map[uuid.UUID]string{checkingRecord: c.checking, cardRecord: c.card} {
		if tx, got := postingOfRecord(t, c.h, record); tx != checkingTx || got != account {
			t.Fatalf("record %s on %s/%s", record, tx, got)
		}
	}
	if s := statements(t, c.h, c.card)["2026-11"]; s.Status != "paid" || s.Payments != 150000 || s.Credits != 0 {
		t.Fatalf("statement = %+v", s)
	}

	var paired struct {
		Kept      string   `json:"kept_transaction_id"`
		Voided    string   `json:"voided_transaction_id"`
		RecordIDs []string `json:"record_ids"`
	}
	var raw []byte
	if err := c.h.Pool.QueryRow(t.Context(), `SELECT payload FROM outbox_event WHERE type = 'ledger.transactions_paired.v1'`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, &paired); err != nil {
		t.Fatal(err)
	}
	if paired.Kept != checkingTx || paired.Voided != cardTx || len(paired.RecordIDs) != 1 || paired.RecordIDs[0] != cardRecord.String() {
		t.Fatalf("paired event = %+v", paired)
	}
}

// S48: several candidates need pair_with.
func TestTransferWithSeveralCandidates(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	checkingTx, _ := importLine(t, c.h, c.checking, "2026-11-10", -150000)
	first, _ := importLine(t, c.h, c.card, "2026-11-09", 150000)
	second, _ := importLine(t, c.h, c.card, "2026-11-11", 150000)

	c.h.ExpectProblem(transfer(c.h, checkingTx, 1, c.card, ""), http.StatusConflict, "pairing_ambiguous", "")
	c.h.ExpectProblem(transfer(c.h, checkingTx, 1, c.card, checkingTx), http.StatusUnprocessableEntity, "validation_failed", "pair_with")
	res := mustTransfer(t, c.h, checkingTx, 1, c.card, second)
	if res.VoidedTransactionID != second || voidReason(t, c.h, first) != "" {
		t.Fatalf("result = %+v; first voided %q", res, voidReason(t, c.h, first))
	}
}

// P5b Review Focus 2: a reconciled side is kept; two reconciled sides cannot pair.
func TestTransferKeepsTheReconciledSide(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	checkingTx, checkingRecord := importLine(t, c.h, c.checking, "2026-11-10", -150000)
	if r := assertBalance(c.h, c.checking, "2026-11-10", -150000); r.Status != http.StatusCreated {
		t.Fatalf("assertion status %d: %s", r.Status, r.Body)
	}
	cardTx, cardRecord := importLine(t, c.h, c.card, "2026-11-11", 150000)

	res := mustTransfer(t, c.h, cardTx, 1, c.checking, "")
	if res.Transaction.ID != checkingTx || res.VoidedTransactionID != cardTx || res.Transaction.Version != 2 {
		t.Fatalf("result = %+v", res)
	}
	for _, p := range res.Transaction.Postings {
		if p.AccountID == c.checking && p.Status != "reconciled" {
			t.Fatalf("checking posting = %+v", p)
		}
	}
	for record, account := range map[uuid.UUID]string{checkingRecord: c.checking, cardRecord: c.card} {
		if tx, got := postingOfRecord(t, c.h, record); tx != checkingTx || got != account {
			t.Fatalf("record %s on %s/%s", record, tx, got)
		}
	}
}

func TestTransferWithBothSidesReconciled(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	cardTx, _ := importLine(t, c.h, c.card, "2026-10-20", 150000)
	if r := reconcileStatement(c, "2026-11", 0); r.Status != http.StatusOK {
		t.Fatalf("reconcile status %d: %s", r.Status, r.Body)
	}
	checkingTx, _ := importLine(t, c.h, c.checking, "2026-10-21", -150000)

	c.h.ExpectProblem(transfer(c.h, checkingTx, 1, c.card, ""), http.StatusConflict, "posting_reconciled", "")
	if v := c.h.Transaction(checkingTx); v.Version != 1 || voidReason(t, c.h, cardTx) != "" {
		t.Fatalf("partial change: checking version %d, card void %q", v.Version, voidReason(t, c.h, cardTx))
	}
}

// P5b Review Focus 5.
func TestTransferRejections(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	sys := systemAccounts(c.h)
	closed := c.h.Account("Old savings", "asset", "savings", nil)
	c.h.MustDo(http.MethodPost, "/api/v1/accounts/"+closed+"/close", map[string]any{"closed_on": "2026-10-31"}, http.StatusOK, nil)
	usd := c.h.Account("Wise", "asset", "checking", map[string]any{"currency": "USD"})
	id, _ := importLine(t, c.h, c.checking, "2026-11-05", -50000)
	for _, account := range []string{c.checking, c.food, closed, usd, sys["uncategorized_expense"]} {
		c.h.ExpectProblem(transfer(c.h, id, 1, account, ""), http.StatusUnprocessableEntity, "validation_failed", "account_id")
	}
	c.h.ExpectProblem(transfer(c.h, id, 2, c.card, ""), http.StatusConflict, "version_conflict", "")
	other := c.h.Record("2026-11-05", apitest.Posting(c.checking, -100), apitest.Posting(c.card, 100))
	c.h.ExpectProblem(transfer(c.h, other, 1, closed, ""), http.StatusUnprocessableEntity, "not_categorizable", "")
}

// A card credit transferred to checking becomes the payment of the oldest unpaid statement (A28).
func TestTransferTurnsCardCreditIntoPayment(t *testing.T) {
	c := newCardSetup(t, "2026-11-12")
	c.purchase("2026-10-14", 150000)
	cardTx, cardRecord := importLine(t, c.h, c.card, "2026-11-11", 150000)
	if p := postingOn(c.h.Transaction(cardTx), c.card); p.CardRole != "credit" || p.Statement != "2026-12" {
		t.Fatalf("imported card posting = %+v", p)
	}

	res := mustTransfer(t, c.h, cardTx, 1, c.checking, "")
	if p := postingOn(res.Transaction, c.card); p.CardRole != "payment" || p.Statement != "2026-11" || p.Amount.Amount != 150000 {
		t.Fatalf("card posting = %+v", p)
	}
	if tx, account := postingOfRecord(t, c.h, cardRecord); tx != cardTx || account != c.card {
		t.Fatalf("record on %s/%s", tx, account)
	}
	if s := statements(t, c.h, c.card)["2026-11"]; s.Status != "paid" {
		t.Fatalf("statement = %+v", s)
	}
}

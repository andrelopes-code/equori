package ingestion_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// cardOFX returns an OFX credit card statement for November 2026.
func cardOFX(lines ...apitest.OFXLine) []byte {
	var b strings.Builder
	b.WriteString("OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>BRL\n<BANKTRANLIST><DTSTART>20261104<DTEND>20261203\n")
	for _, l := range lines {
		fmt.Fprintf(&b, "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>%s<TRNAMT>%s<FITID>%s<MEMO>%s</STMTTRN>\n", l.Date, l.Amount, l.FITID, l.Name)
	}
	b.WriteString("</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>\n")
	return []byte(b.String())
}

type paymentSetup struct {
	h              *apitest.Harness
	checking, card string
}

// newPaymentSetup has statement 2026-11 of the card closed with 1,500.00 of charges.
func newPaymentSetup(t *testing.T) paymentSetup {
	h := apitest.New(t, apitest.Today("2026-11-12"))
	s := paymentSetup{h: h, checking: h.Account("Nubank checking", "asset", "checking", nil), card: h.Card("Itaú Visa", 3, 10, "next")}
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-14", apitest.Posting(s.card, -150000), apitest.Posting(food, 150000))
	return s
}

// recordTransfer records a checking line that Classification decided as a transfer to the card.
func (s paymentSetup) recordTransfer(t *testing.T, date string) uuid.UUID {
	t.Helper()
	d, err := time.Parse(time.DateOnly, date)
	if err != nil {
		t.Fatal(err)
	}
	amount, err := money.New(-150000, "BRL")
	if err != nil {
		t.Fatal(err)
	}
	ids, err := s.h.App.Ledger.RecordImportedBatch(t.Context(), s.h.OwnerID(), []ledger.ImportedRecord{{
		RecordID: uuid.New(),
		Posting:  ledger.ImportedPosting{AccountID: uuid.MustParse(s.checking), Date: d, Amount: amount, Description: "PAGAMENTO FATURA ITAU"},
		Decision: &ledger.ImportDecision{TransferTo: uuid.MustParse(s.card)},
	}})
	if err != nil {
		t.Fatal(err)
	}
	return ids[0]
}

func (s paymentSetup) statementStatus(t *testing.T) string {
	t.Helper()
	var out struct {
		Items []struct {
			Reference string `json:"reference"`
			Status    string `json:"status"`
		} `json:"items"`
	}
	s.h.MustDo(http.MethodGet, "/api/v1/accounts/"+s.card+"/statements?from=2026-11&to=2026-11", nil, http.StatusOK, &out)
	if len(out.Items) != 1 {
		t.Fatalf("statements = %+v", out.Items)
	}
	return out.Items[0].Status
}

func postingAmounts(v apitest.TransactionView) map[string]int64 {
	m := map[string]int64{}
	for _, p := range v.Postings {
		m[p.AccountID] += p.Amount.Amount
	}
	return m
}

func cardRole(v apitest.TransactionView, card string) string {
	for _, p := range v.Postings {
		if p.AccountID == card {
			return p.CardRole + " " + p.Statement
		}
	}
	return ""
}

// S45: the checking line creates the transfer; the card line matches its card posting.
func TestCheckingFirstTransfer(t *testing.T) {
	s := newPaymentSetup(t)
	id := s.recordTransfer(t, "2026-11-10")
	if v := s.h.Transaction(id.String()); len(v.Postings) != 2 || cardRole(v, s.card) != "payment 2026-11" || v.Version != 1 {
		t.Fatalf("transfer = %+v", v)
	}
	b := mustImport(t, s.h, s.card, "ofx", "fatura.ofx", cardOFX(apitest.OFXLine{Date: "20261111", Amount: "1500.00", FITID: "p1", Name: "PAGAMENTO RECEBIDO"}))
	if got := counts(b); got != "received 1 ignored 0 matched 1 created 0 review 0" {
		t.Fatalf("card import: %s", got)
	}
	if rs := records(t, s.h, b.ID, "matched"); len(rs) != 1 || rs[0].TransactionID != id.String() {
		t.Fatalf("records = %+v", rs)
	}
	if st := s.statementStatus(t); st != "paid" {
		t.Fatalf("statement status = %s", st)
	}
}

// S46: the card line came first; the checking line completes its transaction (A30).
func TestCardFirstTransfer(t *testing.T) {
	s := newPaymentSetup(t)
	b := mustImport(t, s.h, s.card, "ofx", "fatura.ofx", cardOFX(apitest.OFXLine{Date: "20261111", Amount: "1500.00", FITID: "p1", Name: "PAGAMENTO RECEBIDO"}))
	created := records(t, s.h, b.ID, "created")
	if len(created) != 1 {
		t.Fatalf("created = %+v", created)
	}
	before := transactionCount(t, s.h)

	id := s.recordTransfer(t, "2026-11-10")
	if id.String() != created[0].TransactionID || transactionCount(t, s.h) != before {
		t.Fatalf("transfer %s, card transaction %s, count %d → %d", id, created[0].TransactionID, before, transactionCount(t, s.h))
	}
	v := s.h.Transaction(id.String())
	if got := postingAmounts(v); v.Version != 2 || len(v.Postings) != 2 || got[s.checking] != -150000 || cardRole(v, s.card) != "payment 2026-11" {
		t.Fatalf("transaction = %+v", v)
	}
	if st := s.statementStatus(t); st != "paid" {
		t.Fatalf("statement status = %s", st)
	}
}

// S47 and P5b Review Focus 3 and 4: pairing two imported files, delivery of the paired
// event twice, and re-imports of both files.
func TestPairedImportsStayPaired(t *testing.T) {
	s := newPaymentSetup(t)
	checkingFile := apitest.OFX("", apitest.OFXLine{Date: "20261110", Amount: "-1500.00", FITID: "c1", Name: "PAGAMENTO FATURA ITAU"})
	cardFile := cardOFX(apitest.OFXLine{Date: "20261111", Amount: "1500.00", FITID: "p1", Name: "PAGAMENTO RECEBIDO"})
	checkingBatch := mustImport(t, s.h, s.checking, "ofx", "nubank.ofx", checkingFile)
	cardBatch := mustImport(t, s.h, s.card, "ofx", "fatura.ofx", cardFile)
	checkingTx := records(t, s.h, checkingBatch.ID, "created")[0].TransactionID
	cardTx := records(t, s.h, cardBatch.ID, "created")[0].TransactionID

	s.h.MustDo(http.MethodPost, "/api/v1/transactions/"+checkingTx+"/transfer", map[string]any{"expected_version": 1, "account_id": s.card}, http.StatusOK, nil)
	s.h.Dispatch()
	if rs := records(t, s.h, cardBatch.ID, "created"); len(rs) != 1 || rs[0].TransactionID != checkingTx {
		t.Fatalf("card record after pairing = %+v, want %s (was %s)", rs, checkingTx, cardTx)
	}
	if _, err := s.h.Pool.Exec(t.Context(), `DELETE FROM outbox_delivery WHERE event_id IN (SELECT id FROM outbox_event WHERE type = 'ledger.transactions_paired.v1')`); err != nil {
		t.Fatal(err)
	}
	s.h.Dispatch()
	if rs := records(t, s.h, cardBatch.ID, "created"); len(rs) != 1 || rs[0].TransactionID != checkingTx {
		t.Fatalf("card record after a repeated event = %+v", rs)
	}

	count := transactionCount(t, s.h)
	for account, file := range map[string][]byte{s.checking: checkingFile, s.card: cardFile} {
		if got := counts(mustImport(t, s.h, account, "ofx", "again.ofx", file)); got != "received 1 ignored 1 matched 0 created 0 review 0" {
			t.Fatalf("re-import: %s", got)
		}
	}
	if transactionCount(t, s.h) != count {
		t.Fatal("re-import created transactions")
	}
	if st := s.statementStatus(t); st != "paid" {
		t.Fatalf("statement status = %s", st)
	}
}

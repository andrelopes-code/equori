package ingestion_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type batchView struct {
	ID     string `json:"id"`
	Counts struct {
		Received    int `json:"received"`
		Ignored     int `json:"ignored"`
		Matched     int `json:"matched"`
		Created     int `json:"created"`
		NeedsReview int `json:"needs_review"`
	} `json:"counts"`
	Balance struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	} `json:"balance"`
}

// ofxLine is one STMTTRN: date YYYYMMDD, amount as written, FITID (empty for none), name.
type ofxLine struct{ date, amount, fitid, name string }

func ofxFile(balance string, lines ...ofxLine) []byte {
	var b strings.Builder
	b.WriteString("OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nCHARSET:1252\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL\n<BANKTRANLIST><DTSTART>20261001<DTEND>20261031\n")
	for _, l := range lines {
		fmt.Fprintf(&b, "<STMTTRN><TRNTYPE>OTHER<DTPOSTED>%s<TRNAMT>%s", l.date, l.amount)
		if l.fitid != "" {
			fmt.Fprintf(&b, "<FITID>%s", l.fitid)
		}
		fmt.Fprintf(&b, "<NAME>%s</STMTTRN>\n", l.name)
	}
	b.WriteString("</BANKTRANLIST>")
	if balance != "" {
		b.WriteString(balance)
	}
	b.WriteString("</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n")
	return []byte(b.String())
}

func importFile(h *apitest.Harness, account, format, name string, content []byte) apitest.Response {
	return h.UploadWith("/api/v1/accounts/"+account+"/imports", map[string]string{"format": format}, name, content)
}

func mustImport(t *testing.T, h *apitest.Harness, account, format, name string, content []byte) batchView {
	t.Helper()
	r := importFile(h, account, format, name, content)
	if r.Status != http.StatusCreated {
		t.Fatalf("import status %d: %s", r.Status, r.Body)
	}
	var b batchView
	r.Decode(t, &b)
	var located batchView
	h.MustDo(http.MethodGet, r.Header.Get("Location"), nil, http.StatusOK, &located)
	if located.ID != b.ID {
		t.Fatalf("Location %q resolves to %q", r.Header.Get("Location"), located.ID)
	}
	return b
}

func counts(b batchView) string {
	c := b.Counts
	return fmt.Sprintf("received %d ignored %d matched %d created %d review %d", c.Received, c.Ignored, c.Matched, c.Created, c.NeedsReview)
}

func transactionCount(t *testing.T, h *apitest.Harness) int {
	t.Helper()
	var n int
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM ledger_transaction`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// S32 and S33.
func TestImportOFX(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	manual := h.Record("2026-10-04", apitest.Posting(checking, -4590), apitest.Posting(food, 4590))
	file := ofxFile("<LEDGERBAL><BALAMT>2834.10<DTASOF>20261031</LEDGERBAL>",
		ofxLine{"20261005", "-45.90", "a1", "Pão de Açúcar"}, ofxLine{"20261012", "-120.00", "a2", "Farmácia"}, ofxLine{"20261015", "3000.00", "a3", "Salário"})

	b := mustImport(t, h, checking, "ofx", "outubro.ofx", file)
	if got := counts(b); got != "received 3 ignored 0 matched 1 created 2 review 0" || b.Balance.Status != "recorded" {
		t.Fatalf("first import: %s, balance %+v", got, b.Balance)
	}
	if m := h.Transaction(manual); m.Postings[0].Status != "reconciled" {
		t.Fatalf("matched entry status = %q, want reconciled by the file balance", m.Postings[0].Status)
	}
	var status struct {
		LastReconciledOn string `json:"last_reconciled_on"`
	}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+checking+"/reconciliation", nil, http.StatusOK, &status)
	if status.LastReconciledOn != "2026-10-31" {
		t.Fatalf("reconciliation = %+v", status)
	}

	before := transactionCount(t, h)
	again := mustImport(t, h, checking, "ofx", "outubro.ofx", file)
	if got := counts(again); got != "received 3 ignored 3 matched 0 created 0 review 0" || transactionCount(t, h) != before {
		t.Fatalf("second import: %s", got)
	}
}

// S34: records without an external id are told apart by their ordinal in the file.
func TestImportCSVWithIdenticalLines(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	h.MustDo(http.MethodPut, "/api/v1/accounts/"+checking+"/csv-profile", map[string]any{
		"date_column": "Data", "date_layout": "DD/MM/YYYY", "amount_column": "Valor", "decimal_separator": ",", "description_column": "Descrição",
		"delimiter": "semicolon",
	}, http.StatusOK, nil)
	lines := func(n int) []byte {
		return []byte("Data;Valor;Descrição\n" + strings.Repeat("07/10/2026;-8,50;Padaria\n", n))
	}
	for _, tc := range []struct {
		n    int
		want string
	}{
		{2, "received 2 ignored 0 matched 0 created 2 review 0"},
		{2, "received 2 ignored 2 matched 0 created 0 review 0"},
		{3, "received 3 ignored 2 matched 0 created 1 review 0"},
	} {
		if got := counts(mustImport(t, h, checking, "csv", "extrato.csv", lines(tc.n))); got != tc.want {
			t.Fatalf("%d lines: %s, want %s", tc.n, got, tc.want)
		}
	}
}

// Review Focus 1: a record left received after the ledger created its transaction completes
// without a second transaction (P4 amendments A11, A12).
func TestImportResumesAnInterruptedRecord(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	file := ofxFile("", ofxLine{"20261012", "-120.00", "a2", "Farmácia"})
	mustImport(t, h, checking, "ofx", "a.ofx", file)
	if _, err := h.Pool.Exec(t.Context(), `UPDATE ingestion_external_record SET state = 'received', transaction_id = NULL`); err != nil {
		t.Fatal(err)
	}
	before := transactionCount(t, h)
	b := mustImport(t, h, checking, "ofx", "a.ofx", file)
	if got := counts(b); got != "received 1 ignored 0 matched 0 created 1 review 0" || transactionCount(t, h) != before {
		t.Fatalf("resumed import: %s, transactions %d → %d", got, before, transactionCount(t, h))
	}
}

// A record matched before the interruption stays matched: the resumed import must not
// create a second transaction for a line the owner had already entered.
func TestImportResumesAnInterruptedMatch(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-12", apitest.Posting(checking, -12000), apitest.Posting(food, 12000))
	file := ofxFile("", ofxLine{"20261012", "-120.00", "a2", "Farmácia"})
	mustImport(t, h, checking, "ofx", "a.ofx", file)
	if _, err := h.Pool.Exec(t.Context(), `UPDATE ingestion_external_record SET state = 'received', transaction_id = NULL`); err != nil {
		t.Fatal(err)
	}
	before := transactionCount(t, h)
	b := mustImport(t, h, checking, "ofx", "a.ofx", file)
	if got := counts(b); got != "received 1 ignored 0 matched 1 created 0 review 0" || transactionCount(t, h) != before {
		t.Fatalf("resumed import: %s, transactions %d → %d", got, before, transactionCount(t, h))
	}
}

// Review Focus 2: one manual entry and two identical lines: one match, one creation (I07).
func TestImportNeverLinksOneTransactionTwice(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.Record("2026-10-12", apitest.Posting(checking, -12000), apitest.Posting(food, 12000))
	b := mustImport(t, h, checking, "ofx", "a.ofx", ofxFile("", ofxLine{"20261012", "-120.00", "x1", "Farmácia"}, ofxLine{"20261012", "-120.00", "x2", "Farmácia"}))
	if got := counts(b); got != "received 2 ignored 0 matched 1 created 1 review 0" {
		t.Fatalf("import: %s", got)
	}
}

// Review Focus 3: a balance the ledger cannot take is skipped; the import still succeeds.
func TestImportSkipsAFutureBalance(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	b := mustImport(t, h, checking, "ofx", "a.ofx", ofxFile("<LEDGERBAL><BALAMT>-120.00<DTASOF>20261130</LEDGERBAL>", ofxLine{"20261012", "-120.00", "a2", "Farmácia"}))
	if b.Balance.Status != "skipped" || b.Balance.Reason == "" || b.Counts.Created != 1 {
		t.Fatalf("batch = %+v", b)
	}
}

// Review Focus 4 and request rules.
func TestImportRejectsBadRequests(t *testing.T) {
	h := apitest.New(t, apitest.Today("2026-11-05"))
	checking := h.Account("Nubank checking", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	h.ExpectProblem(importFile(h, checking, "ofx", "a.ofx", []byte("<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><STMTTRN><DTPOSTED>20261005<TRNAMT>x")), http.StatusUnprocessableEntity, "validation_failed", "file")
	h.ExpectProblem(importFile(h, checking, "csv", "a.csv", []byte("Data,Valor\n")), http.StatusUnprocessableEntity, "validation_failed", "format")
	h.ExpectProblem(importFile(h, checking, "qif", "a.qif", []byte("!Type:Bank")), http.StatusUnprocessableEntity, "validation_failed", "format")
	h.ExpectProblem(importFile(h, food, "ofx", "a.ofx", ofxFile("")), http.StatusUnprocessableEntity, "validation_failed", "account_id")
	var list struct {
		Items []any `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/import-batches", nil, http.StatusOK, &list)
	if len(list.Items) != 0 {
		t.Fatalf("rejected files left batches: %v", list.Items)
	}
	other := h.Login("other@example.com")
	h.ExpectProblem(h.UploadAs(other, "/api/v1/accounts/"+checking+"/imports", map[string]string{"format": "ofx"}, "a.ofx", ofxFile("")),
		http.StatusNotFound, "not_found", "")
}

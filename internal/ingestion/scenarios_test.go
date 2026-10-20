package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// Acceptance scenarios of docs/domain/06-scenarios.md, section 6.11, that phase P4 covers.
// S32 and S33: TestImportOFX; S34: TestImportCSVWithIdenticalLines; S35: TestResolveAsMatch.

// S36: card statement lines are charges and credits billed by the card's cycle.
func TestImportCardStatement(t *testing.T) {
	t.Parallel()
	h := apitest.New(t, apitest.Today("2026-11-12"))
	card := h.Card("Itaú Visa", 3, 10, "next")
	file := []byte("OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>BRL\n" +
		"<BANKTRANLIST><DTSTART>20261004<DTEND>20261103\n" +
		"<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261014<TRNAMT>-230.00<FITID>c1<MEMO>SUPERMERCADO</STMTTRN>\n" +
		"<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261020<TRNAMT>230.00<FITID>c2<MEMO>ESTORNO SUPERMERCADO</STMTTRN>\n" +
		"</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>\n")
	b := mustImport(t, h, card, "ofx", "fatura.ofx", file)
	if got := counts(b); got != "received 2 ignored 0 matched 0 created 2 review 0" {
		t.Fatalf("import: %s", got)
	}
	for _, r := range records(t, h, b.ID, "created") {
		var tx apitest.TransactionView
		h.MustDo(http.MethodGet, "/api/v1/transactions/"+r.TransactionID, nil, http.StatusOK, &tx)
		want := map[bool]string{true: "charge", false: "credit"}[r.Amount.Amount < 0]
		for _, p := range tx.Postings {
			if p.AccountID == card && (p.CardRole != want || p.Statement != "2026-11") {
				t.Fatalf("card posting of %d = %+v, want %s on 2026-11", r.Amount.Amount, p, want)
			}
		}
	}
}

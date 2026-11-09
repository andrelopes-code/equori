package apitest

import (
	"fmt"
	"strings"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// OFXLine is one STMTTRN: Date YYYYMMDD, Amount as written, FITID (empty for none), Name.
type OFXLine struct{ Date, Amount, FITID, Name string }

// OFX is OFXIn in BRL.
func OFX(balance string, lines ...OFXLine) []byte { return OFXIn("BRL", balance, lines...) }

// OFXIn returns an OFX 1.x checking statement for October 2026 in currency; balance is an
// optional LEDGERBAL element.
func OFXIn(currency money.Currency, balance string, lines ...OFXLine) []byte {
	var b strings.Builder
	b.WriteString("OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nCHARSET:UTF-8\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>")
	b.WriteString(string(currency))
	b.WriteString("\n<BANKTRANLIST><DTSTART>20261001<DTEND>20261031\n")

	for _, l := range lines {
		fmt.Fprintf(&b, "<STMTTRN><TRNTYPE>OTHER<DTPOSTED>%s<TRNAMT>%s", l.Date, l.Amount)

		if l.FITID != "" {
			fmt.Fprintf(&b, "<FITID>%s", l.FITID)
		}

		fmt.Fprintf(&b, "<NAME>%s</STMTTRN>\n", l.Name)
	}

	b.WriteString("</BANKTRANLIST>")
	b.WriteString(balance)
	b.WriteString("</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n")

	return []byte(b.String())
}

// CardOFX returns an OFX 1.x credit card statement for November 2026.
func CardOFX(lines ...OFXLine) []byte {
	var b strings.Builder
	b.WriteString("OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>BRL\n<BANKTRANLIST><DTSTART>20261104<DTEND>20261203\n")

	for _, l := range lines {
		fmt.Fprintf(&b, "<STMTTRN><TRNTYPE>OTHER<DTPOSTED>%s<TRNAMT>%s<FITID>%s<MEMO>%s</STMTTRN>\n", l.Date, l.Amount, l.FITID, l.Name)
	}

	b.WriteString("</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>\n")

	return []byte(b.String())
}

// Import uploads a statement file in format (ofx or csv) to the account.
func (h *Harness) Import(account, format, name string, content []byte) Response {
	return h.UploadWith("/api/v1/accounts/"+account+"/imports", map[string]string{"format": format}, name, content)
}

package main

import (
	"fmt"
	"math"
	"strings"
)

// noBalance leaves the closing balance out of a statement file; a reported balance reconciles the account up to its date.
const noBalance = int64(math.MinInt64)

// bankOFX writes an OFX 1.x checking statement. The balance is the closing balance reported by the institution.
func bankOFX(from, to string, balance int64, lines []ofxLine) []byte {
	var b strings.Builder
	b.WriteString("OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nCHARSET:UTF-8\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL\n")
	fmt.Fprintf(&b, "<BANKTRANLIST><DTSTART>%s<DTEND>%s\n", from, to)

	for _, l := range lines {
		fmt.Fprintf(&b, "<STMTTRN><TRNTYPE>OTHER<DTPOSTED>%s<TRNAMT>%s<FITID>%s<NAME>%s</STMTTRN>\n", l.date, l.amount, l.fitid, l.name)
	}

	b.WriteString("</BANKTRANLIST>")

	if balance != noBalance {
		fmt.Fprintf(&b, "<LEDGERBAL><BALAMT>%s<DTASOF>%s</LEDGERBAL>", reais(balance), to)
	}

	b.WriteString("</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n")

	return []byte(b.String())
}

func cardOFX(from, to string, lines []ofxLine) []byte {
	var b strings.Builder
	b.WriteString("OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>BRL\n")
	fmt.Fprintf(&b, "<BANKTRANLIST><DTSTART>%s<DTEND>%s\n", from, to)

	for _, l := range lines {
		fmt.Fprintf(&b, "<STMTTRN><TRNTYPE>OTHER<DTPOSTED>%s<TRNAMT>%s<FITID>%s<MEMO>%s</STMTTRN>\n", l.date, l.amount, l.fitid, l.name)
	}

	b.WriteString("</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>\n")

	return []byte(b.String())
}

type ofxLine struct{ date, amount, fitid, name string }

func reais(cents int64) string {
	sign := ""
	if cents < 0 {
		sign, cents = "-", -cents
	}

	return fmt.Sprintf("%s%d.%02d", sign, cents/100, cents%100)
}

func compact(date string) string { return strings.ReplaceAll(date, "-", "") }

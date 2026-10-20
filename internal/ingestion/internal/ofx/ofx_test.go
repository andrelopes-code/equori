package ofx

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

func parseFile(t *testing.T, name string) (domain.Statement, error) {
	t.Helper()
	b, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return Parse(b, 2)
}

func day(s string) time.Time {
	d, _ := time.Parse(time.DateOnly, s)
	return d
}

func TestParseBankStatements(t *testing.T) {
	t.Parallel()
	for _, name := range []string{"bank-1x-cp1252.ofx", "bank-2x.ofx"} {
		t.Run(name, func(t *testing.T) {
			st, err := parseFile(t, name)
			if err != nil {
				t.Fatal(err)
			}
			if st.Currency != "BRL" || !st.From.Equal(day("2026-10-01")) || !st.To.Equal(day("2026-10-31")) {
				t.Fatalf("header = %s %v %v", st.Currency, st.From, st.To)
			}
			first := st.Records[0]
			if first.ExternalID != "a1" || !first.Date.Equal(day("2026-10-05")) || first.Amount != -4590 || !strings.Contains(first.Description, "Pão de Açúcar") {
				t.Fatalf("first record = %+v", first)
			}
			if _, ok := first.Raw["ACCTID"]; ok {
				t.Fatal("account number stored in the raw record (N16)")
			}
			last := st.Records[len(st.Records)-1]
			if last.Amount != 300000 || last.Description != "Salário" || !last.Date.Equal(day("2026-10-15")) {
				t.Fatalf("last record = %+v", last)
			}
			if st.Balance == nil || !st.Balance.Date.Equal(day("2026-10-31")) {
				t.Fatalf("balance = %+v", st.Balance)
			}
		})
	}
	st, _ := parseFile(t, "bank-1x-cp1252.ofx")
	if r := st.Records[1]; r.Amount != -12000 || r.Description != "Farmácia & Drogaria" || r.ExternalID != "a2" {
		t.Fatalf("comma decimal and entity: %+v", r)
	}
	if st.Balance.Amount != 283410 {
		t.Fatalf("balance amount = %d", st.Balance.Amount)
	}
	st2, _ := parseFile(t, "bank-2x.ofx")
	if st2.Records[1].ExternalID != "" {
		t.Fatalf("record without FITID has external id %q", st2.Records[1].ExternalID)
	}
}

func TestParseCreditCardStatement(t *testing.T) {
	t.Parallel()
	st, err := parseFile(t, "card-1x.ofx")
	if err != nil {
		t.Fatal(err)
	}
	if len(st.Records) != 2 || st.Records[0].Amount != -23000 || st.Records[1].Amount != 23000 || st.Records[1].Description != "ESTORNO SUPERMERCADO" {
		t.Fatalf("records = %+v", st.Records)
	}
}

func TestParseRejectsMalformedFiles(t *testing.T) {
	t.Parallel()
	valid := "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n<STMTTRN>\n<DTPOSTED>20261005\n<TRNAMT>%s\n<FITID>x\n</STMTTRN>\n</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>"
	tests := []struct {
		name, in, want string
	}{
		{"not ofx", "Data,Valor\n01/10/2026,10", "not an OFX file"},
		{"amount", strings.Replace(valid, "%s", "12.3.4", 1), "TRNAMT"},
		{"too many decimals", strings.Replace(valid, "%s", "1.234", 1), "TRNAMT"},
		{"missing date", strings.Replace(strings.Replace(valid, "%s", "1.00", 1), "<DTPOSTED>20261005\n", "", 1), "DTPOSTED"},
		{"truncated", "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n<STMTTRN>\n<DTPOSTED>20261005\n<TRNAMT>1.00", "end of file"},
		{"no statement", "<OFX></OFX>", "no statement"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Parse([]byte(tc.in), 2)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("err = %v, want it to mention %q", err, tc.want)
			}
		})
	}
	if _, err := Parse([]byte(strings.Replace(valid, "%s", "1.00", 1)), 2); err != nil {
		t.Fatalf("valid minimal file: %v", err)
	}
}

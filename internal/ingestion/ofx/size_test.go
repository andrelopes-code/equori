package ofx

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

// parseBudget bounds the parse of a file near the upload limit; a linear parse takes well under it.
const parseBudget = slowdown * 5 * time.Second

// A file of tens of thousands of transactions parses in linear time: locating the line of an
// element must not rescan the file from its start.
func TestParseLargeFileIsLinear(t *testing.T) {
	t.Parallel()

	data := []byte(largeStatement(80_000))
	done := make(chan error, 1)

	go func() {
		st, err := Parse(data, 2)
		if err == nil && len(st.Records) != 80_000 {
			err = fmt.Errorf("records = %d, want 80000", len(st.Records))
		}

		done <- err
	}()

	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(parseBudget):
		t.Fatalf("parse of %d bytes took more than %s", len(data), parseBudget)
	}
}

// Closing tags that match no open element parse in linear time: each one must not scan a deep stack.
func TestParseUnmatchedClosingTagsAreLinear(t *testing.T) {
	t.Parallel()

	data := []byte("<OFX><STMTRS>" + strings.Repeat("<A>", 300_000) + strings.Repeat("</B>", 300_000))
	done := make(chan error, 1)

	go func() {
		_, err := Parse(data, 2)
		done <- err
	}()

	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(parseBudget):
		t.Fatalf("parse of %d bytes took more than %s", len(data), parseBudget)
	}
}

func largeStatement(n int) string {
	var b strings.Builder

	b.WriteString("<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<CURDEF>BRL\n<BANKTRANLIST>\n")

	for i := range n {
		fmt.Fprintf(&b, "<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20261005\n<TRNAMT>-1.00\n<FITID>id%d\n<NAME>x\n</STMTTRN>\n", i)
	}

	b.WriteString("</BANKTRANLIST>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n")

	return b.String()
}

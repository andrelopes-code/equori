package feed_test

import (
	"archive/zip"
	"bytes"
	"fmt"
	"strings"
	"testing"
	"time"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

// cotahistRecord builds a 245-byte type 01 record of the B3 layout (SeriesHistoricas_Layout).
func cotahistRecord(date, ticker, market string, close int64) string {
	r := fmt.Sprintf("01%s02%-12s%s%-12s%-10s%-3s%-4s", date, ticker, market, "NAME", "CI", "", "R$")
	prices := fmt.Sprintf("%013d%013d%013d%013d%013d", close, close, close, close, close)
	r += prices
	return r + strings.Repeat("0", 245-len(r))
}

// cotahistZIP compresses a daily file: header, records, trailer.
func cotahistZIP(t *testing.T, date string, records ...string) []byte {
	t.Helper()
	header := "00COTAHIST." + date[:4] + "BOVESPA " + date
	trailer := "99COTAHIST." + date[:4] + "BOVESPA " + date
	lines := append(append([]string{header + strings.Repeat(" ", 245-len(header))}, records...), trailer+strings.Repeat(" ", 245-len(trailer)))
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("COTAHIST_D" + date[6:8] + date[4:6] + date[:4] + ".TXT")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write([]byte(strings.Join(lines, "\r\n") + "\r\n")); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

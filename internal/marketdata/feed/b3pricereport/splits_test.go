package b3pricereport_test

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/feed/b3pricereport"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// The stock events of three issuers, as their pages state them.
var issuerEvents = map[string]string{
	"SBSP": `[{"stockDividends":[
		{"isinCode":"BRSBSPACNOR5","label":"DESDOBRAMENTO","factor":"400,00000000000","lastDatePrior":"28/04/2026"},
		{"isinCode":"BRSBSPACNOR5","label":"GRUPAMENTO","factor":"0,00800000000","lastDatePrior":"01/06/2007"}]}]`,
	"BBDC": `[{"stockDividends":[
		{"isinCode":"BRBBDCACNOR1","label":"BONIFICACAO","factor":"10,00000000000","lastDatePrior":"18/04/2022"},
		{"isinCode":"BRBBDCACNPR8","label":"BONIFICACAO","factor":"10,00000000000","lastDatePrior":"18/04/2022"},
		{"isinCode":"BRBBDCACNPR8","label":"DESDOBRAMENTO","factor":"4.900,00000000000","lastDatePrior":"08/06/2009"},
		{"isinCode":"BRBBDCACNPR8","label":"GRUPAMENTO","factor":"0,02000000000","lastDatePrior":"08/06/2009"},
		{"isinCode":"BRBBDCACNPR8","label":"CIS RED CAP","factor":"100,00000000000","lastDatePrior":"09/08/2000"}]}]`,
	"KNRI": `[{"stockDividends":[
		{"isinCode":"BRKNRICTF007","label":"DESDOBRAMENTO","factor":"900,00000000000","lastDatePrior":"30/05/2014"}]}]`,
}

// A266 SA2: the events of a class become ratios; two that cancel out on one day, an event that is no
// split and the events of another class give nothing. The page answers JSON inside a JSON string.
func TestSplits(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, err := base64.StdEncoding.DecodeString(
			r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:],
		)
		if err != nil {
			t.Errorf("path %s: %v", r.URL.Path, err)
		}

		var q struct {
			Issuer string `json:"issuingCompany"`
		}
		if err := json.Unmarshal(raw, &q); err != nil {
			t.Error(err)
		}

		switch q.Issuer {
		case "FAIL":
			http.Error(w, "busy", http.StatusBadGateway)
		case "KNRI":
			_, _ = w.Write([]byte(strconv.Quote(issuerEvents["KNRI"])))
		default:
			_, _ = w.Write([]byte(issuerEvents[q.Issuer]))
		}
	}))
	t.Cleanup(srv.Close)

	ins := make([]feed.Instrument, 0, 6)
	for _, code := range []string{"SBSP3", "BBDC4", "KNRI11", "FAIL3", "NONE3", "IMAB11X"} {
		ins = append(ins, feed.Instrument{
			Code:          money.Currency(code),
			Type:          "stock",
			Exchange:      "BVMF",
			QuoteCurrency: "BRL",
		})
	}

	got, err := b3pricereport.New(srv.Client(), srv.URL, today).Splits(t.Context(), ins)
	if err == nil || !strings.Contains(err.Error(), "issuer FAIL: status 502") {
		t.Errorf("error = %v, want the failure of FAIL alone", err)
	}

	lines := make([]string, len(got))
	for i, s := range got {
		lines[i] = fmt.Sprintf("%s %s %s", s.Instrument, s.Date.Format(time.DateOnly), s.Ratio)
	}

	slices.Sort(lines)

	want := []string{
		"BBDC4 2022-04-19 11/10", "KNRI11 2014-05-31 10/1",
		"SBSP3 2007-06-02 1/125", "SBSP3 2026-04-29 5/1",
	}
	if !slices.Equal(lines, want) {
		t.Errorf("splits = %v, want %v", lines, want)
	}
}

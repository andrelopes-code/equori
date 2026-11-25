package alternativeme_test

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/sentiment"
	"github.com/andrelopes-code/equori/internal/marketdata/sentiment/alternativeme"
)

// page is the answer of the API on 2026-11-25 to a limit of 2.
const page = `{"name":"Fear and Greed Index","data":[
	{"value":"13","value_classification":"Extreme Fear","timestamp":"1795564800","time_until_update":"11779"},
	{"value":"11","value_classification":"Extreme Fear","timestamp":"1795478400"}
],"metadata":{"error":null}}`

func TestFetch(t *testing.T) {
	t.Parallel()

	var asked string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = r.URL.String()
		_, _ = w.Write([]byte(page))
	}))
	t.Cleanup(srv.Close)

	src := alternativeme.New(srv.Client(), srv.URL)

	got, err := src.Fetch(t.Context(), 2)
	if err != nil {
		t.Fatal(err)
	}

	want := []sentiment.Value{
		{Date: time.Date(2026, 11, 25, 0, 0, 0, 0, time.UTC), Value: 13},
		{Date: time.Date(2026, 11, 24, 0, 0, 0, 0, time.UTC), Value: 11},
	}
	if !reflect.DeepEqual(got, want) || asked != "/fng/?limit=2" {
		t.Fatalf("asked %s, got %v", asked, got)
	}

	if src.ID() != "alternative_me" || src.Index() != "crypto_fear_greed" {
		t.Fatalf("source %s of %s", src.ID(), src.Index())
	}
}

func TestFetchRefuses(t *testing.T) {
	t.Parallel()

	for name, body := range map[string]string{
		"no data":        `{"data":[]}`,
		"above 100":      `{"data":[{"value":"101","timestamp":"1795564800"}]}`,
		"below 0":        `{"data":[{"value":"-1","timestamp":"1795564800"}]}`,
		"not a number":   `{"data":[{"value":"x","timestamp":"1795564800"}]}`,
		"no timestamp":   `{"data":[{"value":"13","timestamp":""}]}`,
		"a day repeated": `{"data":[{"value":"13","timestamp":"1795564800"},{"value":"12","timestamp":"1795565000"}]}`,
		"not JSON":       `<html>`,
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					_, _ = w.Write([]byte(body))
				}),
			)
			t.Cleanup(srv.Close)

			got, err := alternativeme.New(srv.Client(), srv.URL).Fetch(t.Context(), 0)
			if err == nil || !strings.HasPrefix(err.Error(), "alternative_me: ") {
				t.Fatalf("got %v, err %v", got, err)
			}
		})
	}
}

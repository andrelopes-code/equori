package domain

import (
	"errors"
	"testing"
)

func TestSentimentAnswer(t *testing.T) {
	t.Parallel()

	read := func(value int, date string) SentimentReading {
		return SentimentReading{Enabled: true, Value: &value, Date: day(date)}
	}

	for name, tc := range map[string]struct {
		reading SentimentReading
		limit   string
		want    FactAnswer
		value   string
		reason  string
	}{
		"at the limit":       {read(25, "2026-11-25"), "25", FactYes, "25", ""},
		"above the limit":    {read(26, "2026-11-25"), "25", FactNo, "26", ""},
		"zero":               {read(0, "2026-11-25"), "0", FactYes, "0", ""},
		"three days old":     {read(13, "2026-11-22"), "25", FactYes, "13", ""},
		"four days old":      {read(13, "2026-11-21"), "25", FactNone, "", "stale"},
		"a day ahead in UTC": {read(13, "2026-11-26"), "25", FactYes, "13", ""},
		"no value":           {SentimentReading{Enabled: true}, "25", FactNone, "", "no_index"},
		"source off":         {SentimentReading{}, "25", FactNone, "", "index_off"},
		"no limit":           {read(13, "2026-11-25"), "", FactNone, "", "no_limit"},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, detail := tc.reading.Answer(tc.limit, day("2026-11-25"))
			if got != tc.want || detail.Value != tc.value || detail.Reason != tc.reason {
				t.Errorf("answer %s %+v, want %s %s %s", got, detail, tc.want, tc.value, tc.reason)
			}
		})
	}
}

func TestSentimentLimits(t *testing.T) {
	t.Parallel()

	for limit, want := range map[string]string{"0": "0", "25": "25", "25.0": "25", "100": "100", "": ""} {
		got, err := cleanLimit(limit, "crypto_fear_greed_max")
		if err != nil || got != want {
			t.Errorf("limit %q = %q, %v, want %q", limit, got, err, want)
		}
	}

	for _, limit := range []string{"25.5", "101", "-1"} {
		if _, err := cleanLimit(
			limit,
			"crypto_fear_greed_max",
		); !errors.Is(
			err,
			ErrQuestionInvalid,
		) {
			t.Errorf("limit %q: %v", limit, err)
		}
	}
}

func TestSentimentFacts(t *testing.T) {
	t.Parallel()

	if index, ok := SentimentOf("crypto_fear_greed_max"); !ok || index != "crypto_fear_greed" {
		t.Errorf("index = %q, %v", index, ok)
	}

	if _, ok := SentimentOf("roe_min"); ok {
		t.Error("roe_min reads a sentiment index")
	}

	if SentimentFact("crypto_fear_greed") != "crypto_fear_greed_max" || SentimentFact("x") != "" {
		t.Error("SentimentFact")
	}
}

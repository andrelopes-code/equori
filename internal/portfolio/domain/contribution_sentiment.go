package domain

import (
	"math/big"
	"time"
)

const (
	fearGreedFact = "crypto_fear_greed_max"

	reasonIndexOff = "index_off"
	reasonNoIndex  = "no_index"
	reasonStale    = "stale"

	greatestSentiment = 100
	// sentimentAge is the age in days up to which a value answers (CO17).
	sentimentAge = 3
)

// sentimentIndexes names the index each fact of a market's mood reads.
var sentimentIndexes = map[string]string{fearGreedFact: "crypto_fear_greed"}

// SentimentReading is the latest value of a sentiment index; Value is nil without one.
type SentimentReading struct {
	Enabled bool
	Value   *int
	Date    time.Time
}

// SentimentOf returns the index the fact of a key reads; false for another fact.
func SentimentOf(key string) (string, bool) {
	index, ok := sentimentIndexes[key]

	return index, ok
}

// SentimentFact returns the fact that reads an index, "" without one.
func SentimentFact(index string) string {
	for fact, id := range sentimentIndexes {
		if id == index {
			return fact
		}
	}

	return ""
}

// Answer holds when the value is at most limit, a limit cleanLimits accepts; a value more than three
// days older than today does not answer (CO17).
func (r SentimentReading) Answer(limit string, today time.Time) (FactAnswer, FactDetail) {
	bound, ok := new(big.Rat).SetString(limit)

	switch {
	case !ok:
		return FactNone, FactDetail{Reason: NoLimit}
	case !r.Enabled:
		return FactNone, FactDetail{Reason: reasonIndexOff}
	case r.Value == nil:
		return FactNone, FactDetail{Reason: reasonNoIndex}
	case r.Date.Before(dayOf(today).AddDate(0, 0, -sentimentAge)):
		return FactNone, FactDetail{Reason: reasonStale}
	}

	value := big.NewRat(int64(*r.Value), 1)

	return answer(value.Cmp(bound) <= 0), FactDetail{Value: decimalText(value), Date: &r.Date}
}

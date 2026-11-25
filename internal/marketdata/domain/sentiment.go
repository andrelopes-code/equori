package domain

import (
	"errors"
	"time"
)

// SentimentValues is the number of values a sentiment index takes: 0 to 100.
const SentimentValues = 101

var ErrUnknownSentiment = errors.New("unknown sentiment index")

// SentimentIndex is the stored series of a sentiment index (contribution conditions CO17).
type SentimentIndex struct {
	ID      string
	Enabled bool // the source that serves it is enabled

	Latest *SentimentDay // nil without a stored value
	Since  *time.Time    // first stored day
	Days   int
	Counts [SentimentValues]int // days each value was published on
}

// SentimentDay is the value of an index on one day.
type SentimentDay struct {
	Date  time.Time
	Value int
}

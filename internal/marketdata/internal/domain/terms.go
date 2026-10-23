package domain

import (
	"regexp"
	"time"
)

const (
	DayCountBus252 = "bus252"
	DayCountAct365 = "act365"
	IndexCDI       = "cdi"
)

var indexPattern = regexp.MustCompile(`^[a-z0-9_]{2,40}$`)

// Terms are the contract of a fixed income security: it starts at FaceValue (minor units of the
// quote currency) on IssuedOn, grows by PercentOfIndexBP of the rate of the index plus an annual
// SpreadBP, and matures on MaturesOn (investments design 4.2).
type Terms struct {
	IssuedOn, MaturesOn time.Time
	IndexID             string // empty for a pre-fixed security
	PercentOfIndexBP    int    // 10000 is 100% of the index
	SpreadBP            int
	DayCount            string
	FaceValue           int64
}

// Validate checks the rules the contract cannot state; the contract bounds the numbers.
func (t Terms) Validate() error {
	switch {
	case !t.MaturesOn.After(t.IssuedOn):
		return invalid("matures_on", "must be after issued_on")
	case t.IndexID != "" && !indexPattern.MatchString(t.IndexID):
		return invalid("index_id", "must match ^[a-z0-9_]{2,40}$")
	case t.DayCount != DayCountBus252 && t.DayCount != DayCountAct365:
		return invalid("day_count", "must be bus252 or act365")
	case t.DayCount == DayCountBus252 && t.IndexID != IndexCDI:
		return invalid("day_count", "bus252 counts the business days of the cdi index; use act365")
	}
	return nil
}

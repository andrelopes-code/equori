package domain

import (
	"regexp"
	"slices"
	"strings"
	"time"
)

const (
	DayCountBus252 = "bus252"
	DayCountAct365 = "act365"
)

var indexPattern = regexp.MustCompile(`^[a-z0-9_]{2,40}$`)

// BusinessDayIndexes are the sorted IDs of the indexes that compound by business day, as their
// index sources declare (docs/contributing/regions.md, Index compounding).
type BusinessDayIndexes []string

// Has reports whether the index id compounds by business day.
func (b BusinessDayIndexes) Has(id string) bool { return slices.Contains(b, id) }

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

	// CalendarID counts the business days of bus252 when the index does not compound by
	// business day; empty otherwise (A236 FC5).
	CalendarID     string
	DailyLiquidity bool
	RedeemableFrom time.Time // zero: redeemable from the issue date

	// Payments are the dates of interest and principal, sorted by PaysOn (A236 FC6).
	Payments []Payment

	// RateSteps raise the rate with the days held, under RateStepsApply (progressive rate PR1).
	RateSteps      []RateStep
	RateStepsApply string
}

// Validate checks the rules the contract cannot state; the contract bounds the numbers.
func (t Terms) Validate(daily BusinessDayIndexes) error {
	if err := CheckRateSteps(t.RateSteps, t.RateStepsApply); err != nil {
		return err
	}

	switch {
	case !t.MaturesOn.After(t.IssuedOn):
		return invalid("matures_on", "must be after issued_on")
	case t.IndexID != "" && !indexPattern.MatchString(t.IndexID):
		return invalid("index_id", "must match ^[a-z0-9_]{2,40}$")
	case t.CalendarID != "" && !indexPattern.MatchString(t.CalendarID):
		return invalid("calendar_id", "must match ^[a-z0-9_]{2,40}$")
	case t.DayCount != DayCountBus252 && t.DayCount != DayCountAct365:
		return invalid("day_count", "must be bus252 or act365")
	case t.DayCount == DayCountBus252 && !daily.Has(t.IndexID) && t.CalendarID == "":
		return invalid(
			"day_count",
			"bus252 counts the business days of the "+strings.Join(
				daily,
				" or ",
			)+" index or of calendar_id; use act365 or set calendar_id",
		)
	case !t.RedeemableFrom.IsZero() &&
		(t.RedeemableFrom.Before(t.IssuedOn) || t.RedeemableFrom.After(t.MaturesOn)):
		return invalid("redeemable_from", "must be between issued_on and matures_on")
	}

	return t.validatePayments()
}

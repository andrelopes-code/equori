package domain

import (
	"time"

	"github.com/google/uuid"
)

// Sources of statement facts (A85).
const (
	FactAggregator = "aggregator"
	FactOwner      = "owner"
)

// StatementFact is what an institution reported for a card statement (A85).
type StatementFact struct {
	UserID      int64
	StatementID uuid.UUID
	Source      string
	Closing     *time.Time // nil when the institution did not report it
	Due         time.Time
	Total       int64 // positive when owed, like the statement's amount due
	Minimum     *int64
}

// EffectiveFact is the owner's fact when there is one, else the aggregator's (A86).
func EffectiveFact(facts []StatementFact) *StatementFact {
	var out *StatementFact
	for i := range facts {
		if out == nil || facts[i].Source == FactOwner {
			out = &facts[i]
		}
	}
	return out
}

// StatementOn returns the statement a posting dated d is billed on (T04, A86): the first
// month, from the one before the rule's answer, whose closing date — the stored one when
// closing is set for the month, else projected by the rule in force — is after d, or on it
// when that rule assigns closing-day purchases to the closing statement.
func StatementOn(d time.Time, closing map[ReferenceMonth]time.Time, rules Rules, ruleClosing func(ReferenceMonth, BillingCycleRule) time.Time) (ReferenceMonth, error) {
	projected, err := StatementFor(d, rules)
	if err != nil {
		return ReferenceMonth{}, err
	}
	for m := projected.Add(-1); m.Compare(projected.Add(2)) <= 0; m = m.Add(1) {
		r, err := rules.For(m)
		if err != nil {
			continue
		}
		c, ok := closing[m]
		if !ok {
			c = ruleClosing(m, r)
		}
		if d.Before(c) || (r.Assignment == AssignClosing && d.Equal(c)) {
			return m, nil
		}
	}
	return projected, nil
}

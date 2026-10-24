package domain

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

type Kind string

const (
	Bill         Kind = "bill"
	Income       Kind = "income"
	Subscription Kind = "subscription"
	Transfer     Kind = "transfer"
	Savings      Kind = "savings"
)

// Outflow reports whether money leaves the schedule's account (P7 amendment A46).
func (k Kind) Outflow() bool { return k != Income }

// Terms is one effective-dated version of a schedule's rule and amount (T09, I08).
type Terms struct {
	EffectiveFrom time.Time
	Rule          Rule
	Amount        int64 // minor units of the schedule currency, positive
	// FirstSequence, when set, is the sequence of the version's first date; otherwise the
	// version continues after the earlier versions (A49).
	FirstSequence int
}

// Pause suppresses the dates in [From, To] (P7 amendment A52).
type Pause struct{ From, To time.Time }

type Schedule struct {
	ID                       uuid.UUID
	Kind                     Kind
	AccountID, CounterpartID uuid.UUID
	PayeeID                  uuid.UUID // uuid.Nil without payee
	Description              string
	Currency                 money.Currency
	ToleranceBP, GraceDays   int
	// Calendar is the business-day calendar id, fixed at creation.
	Calendar string
	EndsOn   *time.Time
	// GeneratedUntil is the last date occurrences were generated through.
	GeneratedUntil time.Time
	CreatedAt      time.Time
	Terms          []Terms
	Pauses         []Pause
}

// Planned is an occurrence a schedule expects.
type Planned struct {
	Sequence int
	Date     time.Time
	Amount   int64
}

// Default matching values (P7 amendments A50, A51).
const (
	DefaultToleranceBP = 1000
	DefaultGraceDays   = 3
)

// Validate checks the fields the schedule carries itself; accounts are checked by the app.
func (s Schedule) Validate() error {
	switch s.Kind {
	case Bill, Income, Subscription, Transfer, Savings:
	default:
		return invalid("kind", "must be bill, income, subscription, transfer or savings")
	}
	if n := len([]rune(s.Description)); n < 1 || n > 200 {
		return invalid("description", "must have 1 to 200 characters")
	}
	if s.ToleranceBP < 0 || s.ToleranceBP > 10000 {
		return invalid("match_tolerance_bp", "must be between 0 and 10000")
	}
	if s.GraceDays < 0 || s.GraceDays > 31 {
		return invalid("grace_days", "must be between 0 and 31")
	}
	for _, t := range s.Terms {
		if t.Amount <= 0 {
			return invalid("amount", "must be positive")
		}
		if err := t.Rule.Validate(); err != nil {
			return err
		}
	}
	return nil
}

// Planned returns the occurrences of s with dates in [from, to]. Each terms version produces
// the dates of its rule from its effective date to the next version's; versions after the
// first continue the sequence of the earlier ones (P7 amendment A49). Paused dates and dates
// on or after EndsOn consume their sequence and produce nothing (A52).
func (s Schedule) Planned(from, to time.Time, days BusinessDays) []Planned {
	var out []Planned
	last := 0
	for i, t := range s.Terms {
		upper := to
		if i+1 < len(s.Terms) {
			if next := s.Terms[i+1].EffectiveFrom.AddDate(0, 0, -1); next.Before(upper) {
				upper = next
			}
		}
		// The first version starts at the rule's start, whose date a preceding adjustment may
		// move before it.
		lower := t.EffectiveFrom
		if i == 0 {
			lower = time.Time{}
		}
		for j, d := range t.Rule.Dates(lower, upper, days) {
			seq := d.Sequence
			switch {
			case i > 0 && j == 0 && t.FirstSequence > 0:
				seq = t.FirstSequence
			case i > 0:
				seq = last + 1
			}
			last = seq
			if d.Date.Before(from) || s.Paused(d.Date) || (s.EndsOn != nil && !d.Date.Before(*s.EndsOn)) {
				continue
			}
			out = append(out, Planned{Sequence: seq, Date: d.Date, Amount: t.Amount})
		}
	}
	return out
}

// Paused reports whether d falls inside a pause of the schedule (A52).
func (s Schedule) Paused(d time.Time) bool {
	for _, p := range s.Pauses {
		if !d.Before(p.From) && !d.After(p.To) {
			return true
		}
	}
	return false
}

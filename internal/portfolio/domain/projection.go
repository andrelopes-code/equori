package domain

import (
	"errors"
	"fmt"
	"time"
)

const (
	ModeIncome = "income"
	ModeRate   = "rate"

	maxProjectionChanges = 40
)

var ErrProjectionInvalid = errors.New("invalid projection plan")

// Projection is the plan of a member: ages, rates, the withdrawal and the contribution changes
// (PJ1, PJ2).
type Projection struct {
	WithdrawalAge int
	LastAge       int
	RealReturnBP  int
	InflationBP   int
	Mode          string
	Income        int64 // minor units; set with ModeIncome only
	RateBP        int   // set with ModeRate only
	Changes       []ProjectionChange
}

// ProjectionChange is the monthly contribution from the first day of Month on (PJ2).
type ProjectionChange struct {
	Month  time.Time
	Amount int64
}

// Validate checks the ranges of PJ1 and the changes of PJ2.
func (p Projection) Validate() error {
	switch {
	case p.WithdrawalAge < 18 || p.WithdrawalAge > 100:
		return invalidProjection("withdrawal age must be 18 to 100")
	case p.LastAge <= p.WithdrawalAge || p.LastAge > 120:
		return invalidProjection("last age must be above the withdrawal age and at most 120")
	case p.RealReturnBP < -1000 || p.RealReturnBP > 3000:
		return invalidProjection("real return must be -1000 to 3000 basis points")
	case p.InflationBP < 0 || p.InflationBP > 5000:
		return invalidProjection("inflation must be 0 to 5000 basis points")
	}

	if err := p.validateWithdrawal(); err != nil {
		return err
	}

	return p.validateChanges()
}

// KeepsPast reports whether next holds every stored change before month with its amount and no
// other change before month (PJ4).
func KeepsPast(stored, next []ProjectionChange, month time.Time) bool {
	return sameBefore(stored, next, month) && sameBefore(next, stored, month)
}

// sameBefore reports whether every change of a before month is in b with the same amount.
func sameBefore(a, b []ProjectionChange, month time.Time) bool {
	for _, c := range a {
		if !c.Month.Before(month) {
			continue
		}

		found := false

		for _, o := range b {
			if o.Month.Equal(c.Month) && o.Amount == c.Amount {
				found = true
			}
		}

		if !found {
			return false
		}
	}

	return true
}

func (p Projection) validateWithdrawal() error {
	switch p.Mode {
	case ModeIncome:
		if p.Income <= 0 || p.RateBP != 0 {
			return invalidProjection("income mode takes an income above zero and no rate")
		}
	case ModeRate:
		if p.RateBP < 1 || p.RateBP > 2000 || p.Income != 0 {
			return invalidProjection(
				"rate mode takes a rate of 1 to 2000 basis points and no income",
			)
		}
	default:
		return invalidProjection("withdrawal mode must be income or rate")
	}

	return nil
}

func (p Projection) validateChanges() error {
	if len(p.Changes) < 1 || len(p.Changes) > maxProjectionChanges {
		return invalidProjection("a plan holds 1 to 40 changes")
	}

	months := make(map[string]bool, len(p.Changes))

	for _, c := range p.Changes {
		if c.Month.Day() != 1 {
			return invalidProjection("a change month is the first day of a month")
		}

		if c.Amount < 0 {
			return invalidProjection("a change amount is zero or more")
		}

		key := c.Month.Format(time.DateOnly)
		if months[key] {
			return invalidProjection("two changes share a month")
		}

		months[key] = true
	}

	return nil
}

func invalidProjection(reason string) error {
	return fmt.Errorf("%w: %s", ErrProjectionInvalid, reason)
}

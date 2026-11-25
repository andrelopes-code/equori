package domain

import (
	"errors"
	"fmt"
	"time"
	"unicode/utf8"
)

const (
	ModeIncome = "income"
	ModeRate   = "rate"

	maxProjectionChanges = 40
	maxProjectionIncomes = 20
	maxIncomeName        = 60
)

var ErrProjectionInvalid = errors.New("invalid projection plan")

// Projection is the plan of a member: ages, rates, the withdrawal, the contribution changes, the
// optional premises and the other incomes (PJ1, PJ2, PJ7, PJ8).
type Projection struct {
	WithdrawalAge int
	LastAge       int
	RealReturnBP  int
	InflationBP   int
	Mode          string
	Income        int64 // minor units; set with ModeIncome only
	RateBP        int   // set with ModeRate only
	Changes       []ProjectionChange
	Incomes       []ProjectionIncome

	// PJ7: nil means the plan does not hold the value.
	WithdrawalReturnBP *int
	CautiousReturnBP   *int
	FavorableReturnBP  *int
	GainTaxBP          *int
}

// ProjectionChange is the monthly contribution from the first day of Month on (PJ2).
type ProjectionChange struct {
	Month  time.Time
	Amount int64
}

// ProjectionIncome is a monthly income beside the portfolio, net and in today's money (PJ8).
type ProjectionIncome struct {
	Name     string
	Amount   int64
	StartAge int
	EndAge   *int // nil means the income does not end
}

// Validate checks the ranges of PJ1, the changes of PJ2, the premises of PJ7 and the incomes of PJ8.
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

	if err := p.validatePremises(); err != nil {
		return err
	}

	if err := p.validateIncomes(); err != nil {
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

func (p Projection) validatePremises() error {
	switch {
	case outside(p.WithdrawalReturnBP, -1000, 3000):
		return invalidProjection("withdrawal return must be -1000 to 3000 basis points")
	case outside(p.CautiousReturnBP, -1000, p.RealReturnBP-1):
		return invalidProjection("cautious return must be -1000 to below the real return")
	case outside(p.FavorableReturnBP, p.RealReturnBP+1, 3000):
		return invalidProjection("favorable return must be above the real return to 3000")
	case outside(p.GainTaxBP, 1, 5000):
		return invalidProjection("gain tax must be 1 to 5000 basis points")
	}

	return nil
}

// outside reports whether a value the plan holds leaves [low, high].
func outside(v *int, low, high int) bool {
	return v != nil && (*v < low || *v > high)
}

func (p Projection) validateIncomes() error {
	if len(p.Incomes) > maxProjectionIncomes {
		return invalidProjection("a plan holds at most 20 other incomes")
	}

	for _, i := range p.Incomes {
		name := utf8.RuneCountInString(i.Name)

		switch {
		case name < 1 || name > maxIncomeName:
			return invalidProjection("an income name has 1 to 60 characters")
		case i.Amount <= 0:
			return invalidProjection("an income amount is above zero")
		case i.StartAge < 18 || i.StartAge > 120:
			return invalidProjection("an income starts at 18 to 120")
		case outside(i.EndAge, i.StartAge+1, 120):
			return invalidProjection("an income ends above its start age and at most at 120")
		}
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

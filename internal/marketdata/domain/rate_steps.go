package domain

import (
	"math/big"
	"time"
)

// The rules of a progressive rate (progressive rate design PR2).
const (
	// StepsRetroactive applies the step a day has reached to the whole period since the issue.
	StepsRetroactive = "retroactive"
	// StepsStepped accrues each step from its own day, chained to the price before it.
	StepsStepped = "stepped"
)

// RateStep is the rate a security takes after AfterDays held from its issue date (PR1).
type RateStep struct {
	AfterDays        int
	PercentOfIndexBP int
	SpreadBP         int
}

// CheckRateSteps requires days above zero in increasing order and a rule exactly when steps exist.
func CheckRateSteps(steps []RateStep, apply string) error {
	if len(steps) == 0 {
		if apply != "" {
			return invalid("rate_steps_apply", "is for terms with rate_steps")
		}

		return nil
	}

	if apply != StepsRetroactive && apply != StepsStepped {
		return invalid("rate_steps_apply", "must be retroactive or stepped")
	}

	last := 0
	for _, s := range steps {
		if s.AfterDays <= last {
			return invalid("rate_steps", "after_days must be above 0 and increase")
		}

		last = s.AfterDays
	}

	return nil
}

// AccrueSteps is Accrue for terms whose rate rises with the days held (PR2 to PR4): it accrues the
// terms at each rate and gives each day the price of its rule. Without steps it is Accrue.
func AccrueSteps(
	t Terms,
	steps []RateStep,
	apply string,
	daily BusinessDayIndexes,
	quoteScale int,
	rates []IndexRate,
	from, to time.Time,
	isBusinessDay BusinessDay,
) ([]DatedPrice, error) {
	if len(steps) == 0 {
		return Accrue(t, daily, quoteScale, rates, from, to, isBusinessDay)
	}

	if err := CheckRateSteps(steps, apply); err != nil {
		return nil, err
	}

	runs := make([]map[time.Time]string, len(steps)+1)
	days := []time.Time{}

	for k := range runs {
		v := t
		if k > 0 {
			v.PercentOfIndexBP, v.SpreadBP = steps[k-1].PercentOfIndexBP, steps[k-1].SpreadBP
		}

		prices, err := Accrue(v, daily, quoteScale, rates, t.IssuedOn, to, isBusinessDay)
		if err != nil {
			return nil, err
		}

		runs[k] = map[time.Time]string{}
		for _, p := range prices {
			runs[k][p.Date] = p.Value

			if k == 0 {
				days = append(days, p.Date)
			}
		}
	}

	if apply == StepsRetroactive {
		return retroactive(t, steps, runs, days, from)
	}

	return stepped(t, steps, runs, days, from)
}

// stepOf is the number of steps a day has reached: 0 before the first.
func stepOf(t Terms, steps []RateStep, d time.Time) int {
	k := 0
	for i, s := range steps {
		if !d.Before(t.IssuedOn.AddDate(0, 0, s.AfterDays)) {
			k = i + 1
		}
	}

	return k
}

func retroactive(
	t Terms,
	steps []RateStep,
	runs []map[time.Time]string,
	days []time.Time,
	from time.Time,
) ([]DatedPrice, error) {
	var out []DatedPrice

	for _, d := range days {
		if d.Before(from) {
			continue
		}

		value, ok := runs[stepOf(t, steps, d)][d]
		if !ok {
			continue
		}

		out = append(out, DatedPrice{Date: d, Value: value})
	}

	return out, nil
}

// stepped carries a factor: on the first priced day of step k the price is the chained price of
// step k−1 on that day, and each later day grows by the ratio of the accrual of step k (PR4).
func stepped(
	t Terms,
	steps []RateStep,
	runs []map[time.Time]string,
	days []time.Time,
	from time.Time,
) ([]DatedPrice, error) {
	var out []DatedPrice

	factor := newFloat().SetInt64(1)
	current := 0

	for _, d := range days {
		k := stepOf(t, steps, d)
		if k != current {
			previous, err := chained(runs[current][d], factor)
			if err != nil {
				return nil, err
			}

			start, err := parsePrice(runs[k][d])
			if err != nil {
				return nil, err
			}

			factor.Quo(previous, start)
			current = k
		}

		value, err := chained(runs[current][d], factor)
		if err != nil {
			return nil, err
		}

		if !d.Before(from) {
			out = append(out, DatedPrice{Date: d, Value: value.Text('f', priceDecimals)})
		}
	}

	return out, nil
}

func chained(price string, factor *big.Float) (*big.Float, error) {
	p, err := parsePrice(price)
	if err != nil {
		return nil, err
	}

	return newFloat().Mul(p, factor), nil
}

func parsePrice(s string) (*big.Float, error) {
	p, ok := newFloat().SetString(s)
	if !ok {
		return nil, invalid("price", "is not a decimal")
	}

	return p, nil
}

package domain

import (
	"math/big"
	"time"
)

// FactAnswer is the answer of the filings to a fact question (FQ3).
type FactAnswer string

const (
	FactYes  FactAnswer = "yes"
	FactNo   FactAnswer = "no"
	FactNone FactAnswer = "none"
)

// FiscalYear is the accounts of one fiscal year that the facts read; a nil account is absent.
type FiscalYear struct {
	End time.Time

	TotalAssets        *int64
	CurrentAssets      *int64
	CurrentLiabilities *int64
	LongDebt           *int64
	Revenue            *int64
	GrossProfit        *int64
	NetIncome          *int64
	OperatingCashFlow  *int64
	SharesIssued       *int64
	// CapitalRaised is true when the capital grew with new resources in the year, false when it grew
	// only with reserves, nil when it did not grow or the filing does not say.
	CapitalRaised *bool
}

// CompanyFacts is the fiscal years of one company, newest first; Standard reports the chart of
// accounts the signals read (CR5).
type CompanyFacts struct {
	Standard bool
	// Financial is true for a company of the financial sector, which no study of the signals covers.
	Financial bool
	Years     []FiscalYear
	// Criteria are the figures a criterion with a limit reads.
	Criteria CompanyCriteria
}

// minSignalYears is the number of fiscal years the signals need.
const minSignalYears = 2

// signal evaluates one condition of CR11 on the fiscal years t, t-1 and t-2; t2 holds no account
// when the company has two fiscal years.
type signal func(t, t1, t2 FiscalYear) FactAnswer

// factCatalog is the catalog of FQ2.
var factCatalog = map[string]signal{
	"piotroski_p1": func(t, t1, _ FiscalYear) FactAnswer { return positive(roa(t, t1)) },
	"piotroski_p2": func(t, t1, _ FiscalYear) FactAnswer { return positive(cashFlow(t, t1)) },
	"piotroski_p3": func(t, t1, t2 FiscalYear) FactAnswer {
		return greater(roa(t, t1), ratio(rat(t1.NetIncome), rat(t2.TotalAssets)))
	},
	"piotroski_p4": func(t, t1, _ FiscalYear) FactAnswer {
		return greater(cashFlow(t, t1), roa(t, t1))
	},
	"piotroski_p5": func(t, t1, t2 FiscalYear) FactAnswer {
		return greater(leverage(t1, t2), leverage(t, t1))
	},
	"piotroski_p6": func(t, t1, _ FiscalYear) FactAnswer {
		return greater(currentRatio(t), currentRatio(t1))
	},
	"piotroski_p7": func(t, t1, _ FiscalYear) FactAnswer { return noIssue(t, t1) },
	"piotroski_p8": func(t, t1, _ FiscalYear) FactAnswer {
		return greater(grossMargin(t), grossMargin(t1))
	},
	"piotroski_p9": func(t, t1, t2 FiscalYear) FactAnswer {
		return greater(
			ratio(rat(t.Revenue), rat(t1.TotalAssets)),
			ratio(rat(t1.Revenue), rat(t2.TotalAssets)),
		)
	},
}

// FactKnown reports whether key belongs to the catalog of FQ2.
func FactKnown(key string) bool {
	return IsSignal(key) || HasLimit(key)
}

// IsSignal reports whether key is a signal of Piotroski.
func IsSignal(key string) bool {
	_, ok := factCatalog[key]

	return ok
}

// Answers returns one answer per key of facts, FactNone for "" and for a key outside the catalog,
// and the last day of t. ok is false, and every answer FactNone, when the chart is not standard, for
// a financial company and with fewer than two fiscal years (FQ3, FQ6).
func (f CompanyFacts) Answers(facts []string) (answers []FactAnswer, year time.Time, ok bool) {
	answers = make([]FactAnswer, len(facts))
	for i := range answers {
		answers[i] = FactNone
	}

	if !f.Standard || f.Financial || len(f.Years) < minSignalYears {
		return answers, time.Time{}, false
	}

	t, t1 := f.Years[0], f.Years[1]

	var t2 FiscalYear
	if len(f.Years) > 2 {
		t2 = f.Years[2]
	}

	for i, key := range facts {
		if eval, known := factCatalog[key]; known {
			answers[i] = eval(t, t1, t2)
		}
	}

	return answers, t.End, true
}

// noIssue answers P7: no common equity issued in t. A rise of the capital says by itself what it
// was made of; without one, a rise of the count of shares has no known cause.
func noIssue(t, t1 FiscalYear) FactAnswer {
	switch {
	case t.CapitalRaised != nil:
		return answer(!*t.CapitalRaised)
	case t.SharesIssued == nil || t1.SharesIssued == nil || *t.SharesIssued > *t1.SharesIssued:
		return FactNone
	}

	return FactYes
}

func roa(t, t1 FiscalYear) *big.Rat {
	return ratio(rat(t.NetIncome), rat(t1.TotalAssets))
}

func cashFlow(t, t1 FiscalYear) *big.Rat {
	return ratio(rat(t.OperatingCashFlow), rat(t1.TotalAssets))
}

// leverage divides the long debt of y by the mean of the assets of y and of the year before it.
func leverage(y, before FiscalYear) *big.Rat {
	return ratio(rat(y.LongDebt), mean(rat(y.TotalAssets), rat(before.TotalAssets)))
}

func currentRatio(y FiscalYear) *big.Rat {
	return ratio(rat(y.CurrentAssets), rat(y.CurrentLiabilities))
}

func grossMargin(y FiscalYear) *big.Rat {
	return ratio(rat(y.GrossProfit), rat(y.Revenue))
}

func rat(v *int64) *big.Rat {
	if v == nil {
		return nil
	}

	return new(big.Rat).SetInt64(*v)
}

// ratio is nil when an input is nil or the divisor is not above zero.
func ratio(numerator, divisor *big.Rat) *big.Rat {
	if numerator == nil || divisor == nil || divisor.Sign() <= 0 {
		return nil
	}

	return new(big.Rat).Quo(numerator, divisor)
}

func mean(a, b *big.Rat) *big.Rat {
	if a == nil || b == nil {
		return nil
	}

	sum := new(big.Rat).Add(a, b)

	return sum.Quo(sum, big.NewRat(2, 1))
}

func positive(r *big.Rat) FactAnswer {
	if r == nil {
		return FactNone
	}

	return answer(r.Sign() > 0)
}

func greater(a, b *big.Rat) FactAnswer {
	if a == nil || b == nil {
		return FactNone
	}

	return answer(a.Cmp(b) > 0)
}

func answer(holds bool) FactAnswer {
	if holds {
		return FactYes
	}

	return FactNo
}

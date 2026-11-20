package domain

import (
	"math/big"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Held is the quantity and cost basis of a security account at the end of a date.
type Held struct {
	Quantity, Cost int64
}

// HoldingPeriod is what a security account did over (start, end] (attribution AT2, AT4): its
// holding at both ends, the result of its sales net of fees and taxes, its income net of
// withholding, and the money put into it on each day.
type HoldingPeriod struct {
	AccountID  uuid.UUID
	Instrument money.Currency
	Start, End Held
	Realized   int64
	Income     int64
	Flows      []CashFlow
}

// Active reports whether the account held units at either end or moved in the period.
func (h HoldingPeriod) Active() bool {
	return h.Start.Quantity != 0 || h.End.Quantity != 0 || h.Realized != 0 || h.Income != 0 ||
		len(h.Flows) != 0
}

// HoldingPeriods returns one HoldingPeriod per security of f over (start, end].
func HoldingPeriods(f Facts, start, end time.Time) []HoldingPeriod {
	out := make([]HoldingPeriod, 0, len(f.Securities))
	index := make(map[uuid.UUID]int, len(f.Securities))

	for _, s := range f.Securities {
		index[s.AccountID] = len(out)
		out = append(out, HoldingPeriod{AccountID: s.AccountID, Instrument: s.Instrument})
	}

	sales := map[uuid.UUID]map[time.Time]int64{}
	for _, t := range f.Trades {
		i, ok := index[t.AccountID]
		if !ok || (t.Side != "sell" && t.Side != "write_off") || !within(t.Date, start, end) {
			continue
		}

		net := t.Gross - t.Fees - t.Taxes - t.Cost
		out[i].Realized += net

		if sales[t.AccountID] == nil {
			sales[t.AccountID] = map[time.Time]int64{}
		}

		sales[t.AccountID][t.Date] += net
	}

	// Net income leaves the holding for the cash on its date (AT4): a flow out, so the cash keeps
	// the capital it adds.
	for _, in := range f.Incomes {
		if i, ok := index[in.AccountID]; ok && within(in.Date, start, end) {
			net := in.Gross - in.Withheld
			out[i].Income += net

			if sales[in.AccountID] == nil {
				sales[in.AccountID] = map[time.Time]int64{}
			}

			sales[in.AccountID][in.Date] += net
		}
	}

	addPostings(out, index, f.Postings, sales, start, end)

	return out
}

// addPostings sets the holding at both ends and the daily flows: the cost a day adds less the money
// the day takes out beyond cost (outs: the net result of its sales and its net income), so a
// purchase puts in gross + fees, a sale takes out its proceeds net of fees and taxes and an
// income takes out what it paid.
func addPostings(
	out []HoldingPeriod,
	index map[uuid.UUID]int,
	postings []Posting,
	outs map[uuid.UUID]map[time.Time]int64,
	start, end time.Time,
) {
	days := map[uuid.UUID]map[time.Time]int64{}

	for _, p := range postings {
		i, ok := index[p.AccountID]
		if !ok || p.Date.After(end) {
			continue
		}

		out[i].End.Quantity += p.Quantity
		out[i].End.Cost += p.Weight

		if !p.Date.After(start) {
			out[i].Start.Quantity += p.Quantity
			out[i].Start.Cost += p.Weight

			continue
		}

		if days[p.AccountID] == nil {
			days[p.AccountID] = map[time.Time]int64{}
		}

		days[p.AccountID][p.Date] += p.Weight
	}

	for id, byDay := range outs {
		for day, net := range byDay {
			if days[id] == nil {
				days[id] = map[time.Time]int64{}
			}

			days[id][day] -= net
		}
	}

	for id, byDay := range days {
		for day, amount := range byDay {
			if amount != 0 {
				out[index[id]].Flows = append(
					out[index[id]].Flows,
					CashFlow{Date: day, Amount: amount},
				)
			}
		}
	}
}

// DietzBP is the modified Dietz return of a holding over (start, end] in basis points, rounded half
// to even (AT4): result ÷ (startValue + Σ wᵢ × Fᵢ), wᵢ = (end − dateᵢ) ÷ (end − start) in days.
// ok is false when the denominator is not positive or the period is empty.
func DietzBP(start, end time.Time, startValue, result int64, flows []CashFlow) (bp int, ok bool) {
	return RatioBP(result, Capital(start, end, startValue, flows))
}

// Capital is the money at work over (start, end] in minor units times days: startValue × T +
// Σ Fᵢ × (end − dateᵢ), T the days of the period. Divided by T it is the average capital, the
// denominator of the modified Dietz return (AT4, AT8).
func Capital(start, end time.Time, startValue int64, flows []CashFlow) DayCapital {
	days := dayCount(start, end)
	if days <= 0 {
		return DayCapital{Sum: big.NewInt(0)}
	}

	sum := new(big.Int).Mul(big.NewInt(startValue), big.NewInt(days))
	for _, f := range flows {
		sum.Add(sum, new(big.Int).Mul(big.NewInt(f.Amount), big.NewInt(dayCount(f.Date, end))))
	}

	return DayCapital{Sum: sum, Days: days}
}

// DayCapital is a capital times days and the days of its period.
type DayCapital struct {
	Sum  *big.Int
	Days int64
}

// RatioBP is result ÷ (capital ÷ days) in basis points, rounded half to even; ok is false when
// the capital is not positive.
func RatioBP(result int64, c DayCapital) (bp int, ok bool) {
	if c.Days <= 0 || c.Sum.Sign() <= 0 {
		return 0, false
	}

	num := new(big.Int).Mul(big.NewInt(result), big.NewInt(c.Days))
	num.Mul(num, big.NewInt(10000))

	return int(halfEven(new(big.Rat).SetFrac(num, c.Sum))), true
}

func within(d, start, end time.Time) bool { return d.After(start) && !d.After(end) }

func dayCount(from, to time.Time) int64 { return int64(to.Sub(from).Hours() / 24) }

// halfEven rounds r to the nearest integer, ties to the even one.
func halfEven(r *big.Rat) int64 {
	q, m := new(big.Int).QuoRem(r.Num(), r.Denom(), new(big.Int))
	twice := new(big.Int).Abs(m)
	twice.Mul(twice, big.NewInt(2))

	cmp := twice.Cmp(r.Denom())
	if cmp > 0 || (cmp == 0 && q.Bit(0) == 1) {
		if r.Sign() < 0 {
			q.Sub(q, big.NewInt(1))
		} else {
			q.Add(q, big.NewInt(1))
		}
	}

	return q.Int64()
}

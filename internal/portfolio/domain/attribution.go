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

	for _, in := range f.Incomes {
		if i, ok := index[in.AccountID]; ok && within(in.Date, start, end) {
			out[i].Income += in.Gross - in.Withheld
		}
	}

	addPostings(out, index, f.Postings, sales, start, end)

	return out
}

// addPostings sets the holding at both ends and the daily flows: the cost a day adds less the net
// result of the day's sales, so a purchase puts in gross + fees and a sale takes out its proceeds
// net of fees and taxes.
func addPostings(
	out []HoldingPeriod,
	index map[uuid.UUID]int,
	postings []Posting,
	sales map[uuid.UUID]map[time.Time]int64,
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

	for id, byDay := range sales {
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
	days := dayCount(start, end)
	if days <= 0 {
		return 0, false
	}

	total := big.NewInt(0)
	weighted := new(big.Int).Mul(big.NewInt(startValue), big.NewInt(days))

	for _, f := range flows {
		w := new(big.Int).Mul(big.NewInt(f.Amount), big.NewInt(dayCount(f.Date, end)))
		weighted.Add(weighted, w)
	}

	if weighted.Sign() <= 0 {
		return 0, false
	}

	// result × days × 10000 ÷ weighted.
	total.Mul(big.NewInt(result), big.NewInt(days))
	total.Mul(total, big.NewInt(10000))

	return int(halfEven(new(big.Rat).SetFrac(total, weighted))), true
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

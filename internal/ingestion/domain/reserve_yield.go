package domain

import (
	"slices"
	"time"
)

// maxYieldDays bounds the search of a yield of several days, which grows with each day.
const maxYieldDays = 8

// YieldOutcome is what a yield line of an account with reserved balances resolves to (A264).
type YieldOutcome int

const (
	// YieldReview: neither a reserve nor the account's balance explains the line.
	YieldReview YieldOutcome = iota
	// YieldOwn: the line moved the account.
	YieldOwn
	// YieldReserve: the line reports the yield of a reserve.
	YieldReserve
)

// YieldLine is a yield line to decide. Closed: a reconciled balance of a later date left it out
// (A261). Held: it already waits for review.
type YieldLine struct {
	Date         time.Time
	Amount       int64
	Closed, Held bool
}

// YieldSpan is the yield of one reserve over the days From to To.
type YieldSpan struct {
	From, To time.Time
	Amount   int64
}

// DecideYields decides each line by the reserves' yields and by gap, what the account's reported
// balance still lacks; nil when the balance decides nothing (A264, RY3 to RY7).
func DecideYields(lines []YieldLine, spans []YieldSpan, gap *int64) []YieldOutcome {
	out := make([]YieldOutcome, len(lines))
	fresh := undecided(lines, out, func(l YieldLine) bool { return !l.Closed && !l.Held })

	if gap != nil && sumOf(lines, fresh) == *gap {
		mark(out, fresh, YieldOwn)
		fresh = nil
	}

	for _, s := range spans {
		within := undecided(lines, out, func(l YieldLine) bool {
			return !l.Date.Before(s.From) && !l.Date.After(s.To)
		})
		if found, ok := dailySum(lines, within, s.Amount); ok {
			mark(out, found, YieldReserve)
		}
	}

	fresh = slices.DeleteFunc(fresh, func(i int) bool { return out[i] != YieldReview })
	if gap == nil {
		mark(out, fresh, YieldOwn)

		return out
	}

	left := *gap - sumOf(lines, decidedAs(out, YieldOwn))
	if found, ok := dailySum(lines, fresh, left); ok {
		mark(out, found, YieldOwn)

		return out
	}

	open := undecided(lines, out, func(l YieldLine) bool { return !l.Closed })
	if found, ok := dailySum(lines, open, left); ok {
		mark(out, found, YieldOwn)
	}

	return out
}

// undecided returns the lines in review that keep accepts.
func undecided(lines []YieldLine, out []YieldOutcome, keep func(YieldLine) bool) []int {
	var found []int

	for i, l := range lines {
		if out[i] == YieldReview && keep(l) {
			found = append(found, i)
		}
	}

	return found
}

func decidedAs(out []YieldOutcome, o YieldOutcome) []int {
	var found []int

	for i := range out {
		if out[i] == o {
			found = append(found, i)
		}
	}

	return found
}

func sumOf(lines []YieldLine, indexes []int) int64 {
	var total int64
	for _, i := range indexes {
		total += lines[i].Amount
	}

	return total
}

func mark(out []YieldOutcome, indexes []int, o YieldOutcome) {
	for _, i := range indexes {
		out[i] = o
	}
}

// dailySum returns the only choice of at most one line of each day that sums to total; lines of
// one day and amount are the same choice. ok is false without a choice, or with more than one.
func dailySum(lines []YieldLine, indexes []int, total int64) (found []int, ok bool) {
	days := byDay(lines, indexes)
	if total < 0 || len(days) > maxYieldDays {
		return nil, false
	}

	var (
		choices int
		chosen  []int
	)

	var walk func(day int, left int64)

	walk = func(day int, left int64) {
		if left == 0 {
			choices++
			found = slices.Clone(chosen)

			return
		}

		if day == len(days) || choices > 1 {
			return
		}

		walk(day+1, left)

		for _, i := range days[day] {
			if lines[i].Amount <= left {
				chosen = append(chosen, i)
				walk(day+1, left-lines[i].Amount)

				chosen = chosen[:len(chosen)-1]
			}
		}
	}
	walk(0, total)

	return found, choices == 1
}

// byDay groups the lines by date and keeps one line of each amount of a day.
func byDay(lines []YieldLine, indexes []int) [][]int {
	sorted := slices.Clone(indexes)
	slices.SortStableFunc(sorted, func(a, b int) int {
		return lines[a].Date.Compare(lines[b].Date)
	})

	var days [][]int

	for _, i := range sorted {
		last := len(days) - 1
		if last < 0 || !lines[days[last][0]].Date.Equal(lines[i].Date) {
			days = append(days, []int{i})
			continue
		}

		if !slices.ContainsFunc(days[last], func(j int) bool {
			return lines[j].Amount == lines[i].Amount
		}) {
			days[last] = append(days[last], i)
		}
	}

	return days
}

package domain

import (
	"errors"
	"testing"
	"time"
)

func TestProjectionValidate(t *testing.T) {
	t.Parallel()

	ok := func() Projection {
		return Projection{
			WithdrawalAge: 65,
			LastAge:       95,
			RealReturnBP:  400,
			InflationBP:   300,
			Mode:          "income",
			Income:        500000,
			Changes:       []ProjectionChange{{Month: day("2026-11-01"), Amount: 0}},
		}
	}

	tests := []struct {
		name  string
		patch func(p *Projection)
		valid bool
	}{
		{"valid income", func(*Projection) {}, true},
		{"valid rate", func(p *Projection) { p.Mode, p.Income, p.RateBP = "rate", 0, 400 }, true},
		{"age 18", func(p *Projection) { p.WithdrawalAge = 18 }, true},
		{"age 17", func(p *Projection) { p.WithdrawalAge = 17 }, false},
		{"age 101", func(p *Projection) { p.WithdrawalAge = 101 }, false},
		{"last age 120", func(p *Projection) { p.LastAge = 120 }, true},
		{"last age 121", func(p *Projection) { p.LastAge = 121 }, false},
		{"last age equals age", func(p *Projection) { p.LastAge = 65 }, false},
		{"real return -1000", func(p *Projection) { p.RealReturnBP = -1000 }, true},
		{"real return -1001", func(p *Projection) { p.RealReturnBP = -1001 }, false},
		{"real return 3000", func(p *Projection) { p.RealReturnBP = 3000 }, true},
		{"real return 3001", func(p *Projection) { p.RealReturnBP = 3001 }, false},
		{"inflation 0", func(p *Projection) { p.InflationBP = 0 }, true},
		{"inflation -1", func(p *Projection) { p.InflationBP = -1 }, false},
		{"inflation 5001", func(p *Projection) { p.InflationBP = 5001 }, false},
		{"income 0", func(p *Projection) { p.Income = 0 }, false},
		{"income with a rate", func(p *Projection) { p.RateBP = 400 }, false},
		{"unknown mode", func(p *Projection) { p.Mode = "other" }, false},
		{"rate 0", func(p *Projection) { p.Mode, p.Income, p.RateBP = "rate", 0, 0 }, false},
		{"rate 2001", func(p *Projection) { p.Mode, p.Income, p.RateBP = "rate", 0, 2001 }, false},
		{"rate with an income", func(p *Projection) { p.Mode, p.RateBP = "rate", 400 }, false},
		{"no change", func(p *Projection) { p.Changes = nil }, false},
		{"day 2", func(p *Projection) { p.Changes[0].Month = day("2026-11-02") }, false},
		{"amount -1", func(p *Projection) { p.Changes[0].Amount = -1 }, false},
		{"duplicate month", func(p *Projection) {
			p.Changes = append(p.Changes, p.Changes[0])
		}, false},
		{
			"40 changes",
			func(p *Projection) { p.Changes = changesFrom(day("2026-01-01"), 40) },
			true,
		},
		{
			"41 changes",
			func(p *Projection) { p.Changes = changesFrom(day("2026-01-01"), 41) },
			false,
		},
	}

	for _, tt := range tests {
		p := ok()
		tt.patch(&p)

		err := p.Validate()
		if tt.valid && err != nil {
			t.Errorf("%s: Validate() = %v, want nil", tt.name, err)
		}

		if !tt.valid && !errors.Is(err, ErrProjectionInvalid) {
			t.Errorf("%s: Validate() = %v, want ErrProjectionInvalid", tt.name, err)
		}
	}
}

func TestKeepsPast(t *testing.T) {
	t.Parallel()

	change := func(month string, amount int64) ProjectionChange {
		return ProjectionChange{Month: day(month), Amount: amount}
	}
	stored := []ProjectionChange{change("2026-09-01", 10), change("2026-11-01", 20)}
	now := day("2026-11-01")

	tests := []struct {
		name string
		next []ProjectionChange
		want bool
	}{
		{"same", []ProjectionChange{change("2026-09-01", 10), change("2026-11-01", 20)}, true},
		{
			"current month replaced",
			[]ProjectionChange{change("2026-09-01", 10), change("2026-11-01", 99)},
			true,
		},
		{
			"future added",
			[]ProjectionChange{change("2026-09-01", 10), change("2027-01-01", 5)},
			true,
		},
		{
			"past altered",
			[]ProjectionChange{change("2026-09-01", 11), change("2026-11-01", 20)},
			false,
		},
		{"past dropped", []ProjectionChange{change("2026-11-01", 20)}, false},
		{"past added", []ProjectionChange{
			change("2026-08-01", 1), change("2026-09-01", 10), change("2026-11-01", 20),
		}, false},
	}

	for _, tt := range tests {
		if got := KeepsPast(stored, tt.next, now); got != tt.want {
			t.Errorf("%s: KeepsPast() = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func changesFrom(start time.Time, n int) []ProjectionChange {
	out := make([]ProjectionChange, n)
	for i := range out {
		out[i] = ProjectionChange{Month: start.AddDate(0, i, 0), Amount: 1}
	}

	return out
}

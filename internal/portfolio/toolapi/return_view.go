package toolapi

import (
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

func excludedViewOf(e *app.Excluded) excludedView {
	if e == nil {
		return excludedView{}
	}

	part := func(t *app.ExcludedTotal) excludedPartView {
		if t == nil {
			return excludedPartView{}
		}

		return excludedPartView{Amount: tool.MoneyOf(t.Amount), Categories: t.Categories}
	}

	return excludedView{Income: part(e.Income), Expense: part(e.Expense)}
}

func inflationOf(i *app.Inflation) inflationView {
	if i == nil {
		return inflationView{}
	}

	return inflationView{
		Index:    i.Index,
		From:     i.From.Format(time.DateOnly),
		Until:    i.Until.Format(time.DateOnly),
		IndexBP:  i.IndexBP,
		ReturnBP: i.ReturnBP,
		RealBP:   i.RealBP,
	}
}

func benchmarkOf(b *app.Benchmark) benchmarkView {
	if b == nil {
		return benchmarkView{}
	}

	return benchmarkView{
		Index:     b.Index,
		From:      b.From.Format(time.DateOnly),
		Until:     b.Until.Format(time.DateOnly),
		ReturnBP:  valueOf(b.ReturnBP),
		IndexBP:   b.IndexBP,
		PercentBP: valueOf(b.PercentBP),

		AnnualBP:      valueOf(b.AnnualBP),
		IndexAnnualBP: valueOf(b.IndexAnnualBP),
		ExcessBP:      valueOf(b.ExcessBP),
		Days:          b.Days,
		Skipped:       b.Skipped,

		Credits:        b.Credits,
		Restarted:      b.Restarted,
		StartedLate:    b.StartedLate,
		PercentErrorBP: valueOf(b.PercentErrorBP),
	}
}

// valueOf is the integer p points to, or 0; a tool schema has no null (ADR 012 T4).
func valueOf(p *int) int {
	if p == nil {
		return 0
	}

	return *p
}

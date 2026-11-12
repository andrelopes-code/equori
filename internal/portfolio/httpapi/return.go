package httpapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

func (s *Server) getReturn(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (ReturnReport, error) {
	params, err := httpserver.Query[GetReturnParams](r)
	if err != nil {
		return ReturnReport{}, err
	}

	var in money.Currency
	if params.ValueIn != nil {
		in = money.Currency(*params.ValueIn)
	}

	var account uuid.UUID
	if params.AccountId != nil {
		account = *params.AccountId
	}

	var index string
	if params.Index != nil {
		index = *params.Index
	}

	res, err := s.svc.Return(
		ctx,
		auth.MustBooksID(ctx),
		account,
		params.From.Time,
		params.To.Time,
		in,
		index,
	)
	if err != nil {
		return ReturnReport{}, err
	}

	return toReturnReportAPI(res), nil
}

func toReturnReportAPI(res app.ReturnReport) ReturnReport {
	out := ReturnReport{
		AnnualBp: res.AnnualBP,
		Opening:  toMoney(res.Opening),
		Closing:  toMoney(res.Closing),
		Flows:    make([]ReturnFlow, len(res.Flows)),
		Profile:  ReturnReportProfile(res.Profile),
		PeriodBp: res.PeriodBP,
	}
	for i, f := range res.Flows {
		out.Flows[i] = ReturnFlow{Date: date(f.Date), Amount: toMoney(f.Amount)}
	}

	if b := res.Benchmark; b != nil {
		out.Benchmark = toReturnBenchmarkAPI(b)
	}

	if res.Index != "" {
		out.Index = &res.Index
	}

	if res.UnavailableReason != "" {
		out.UnavailableReason = &res.UnavailableReason
	}

	if e := res.Excluded; e != nil {
		out.Excluded = &ReturnExcluded{Income: excludedOf(e.Income), Expense: excludedOf(e.Expense)}
	}

	if i := res.Inflation; i != nil {
		out.Inflation = toReturnInflationAPI(i)
	}

	return out
}

func toReturnBenchmarkAPI(b *app.Benchmark) *ReturnBenchmark {
	return &ReturnBenchmark{
		Index:     b.Index,
		From:      date(b.From),
		Until:     date(b.Until),
		Days:      b.Days,
		Skipped:   b.Skipped,
		Credits:   b.Credits,
		Restarted: b.Restarted,

		StartedLate: b.StartedLate,

		ReturnBp:  b.ReturnBP,
		ExcessBp:  b.ExcessBP,
		IndexBp:   b.IndexBP,
		PercentBp: b.PercentBP,

		AnnualBp:      b.AnnualBP,
		IndexAnnualBp: b.IndexAnnualBP,

		PercentErrorBp: b.PercentErrorBP,
	}
}

func toReturnInflationAPI(i *app.Inflation) *ReturnInflation {
	return &ReturnInflation{
		Index:    i.Index,
		From:     date(i.From),
		Until:    date(i.Until),
		IndexBp:  i.IndexBP,
		ReturnBp: i.ReturnBP,
		RealBp:   i.RealBP,
	}
}

func excludedOf(t *app.ExcludedTotal) *ReturnExcludedPart {
	if t == nil {
		return nil
	}

	return &ReturnExcludedPart{Amount: toMoney(t.Amount), Categories: t.Categories}
}

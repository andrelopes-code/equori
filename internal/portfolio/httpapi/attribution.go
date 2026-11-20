package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

func (s *Server) getAttribution(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (AttributionReport, error) {
	years, err := s.svc.Attribution(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return AttributionReport{}, err
	}

	out := AttributionReport{Years: make([]AttributionYear, len(years))}
	for i, y := range years {
		out.Years[i] = toAttributionYear(y)
	}

	return out, nil
}

func toAttributionYear(y app.AttributionYear) AttributionYear {
	out := AttributionYear{Year: y.Year, From: date(y.From), To: date(y.To)}

	if y.Missing != nil {
		missing := make([]string, len(y.Missing))
		for i, code := range y.Missing {
			missing[i] = string(code)
		}

		out.Missing = &missing

		return out
	}

	result, capital := toMoney(*y.Result), toMoney(*y.Capital)
	other := toAttributionPart(*y.Other)
	items := make([]AttributionItem, len(y.Items))

	for i, it := range y.Items {
		part := toAttributionPart(it.AttributionPart)
		items[i] = AttributionItem{
			Instrument:     string(it.Instrument),
			Result:         part.Result,
			WeightBp:       part.WeightBp,
			ContributionBp: part.ContributionBp,
			ReturnBp:       part.ReturnBp,
		}

		if it.StaleSince != nil {
			d := date(*it.StaleSince)
			items[i].StaleSince = &d
		}
	}

	since := date(y.Since)
	out.Since = &since
	out.Result, out.Capital, out.ReturnBp = &result, &capital, y.ReturnBP
	out.Other, out.Items = &other, &items
	out.Rate, out.Inflation = toAttributionCompare(y.Rate), toAttributionCompare(y.Inflation)

	return out
}

func toAttributionPart(p app.AttributionPart) AttributionPart {
	return AttributionPart{
		Result:         toMoney(p.Result),
		WeightBp:       p.WeightBP,
		ContributionBp: p.ContributionBP,
		ReturnBp:       p.ReturnBP,
	}
}

func toAttributionCompare(c *app.AttributionCompare) *AttributionCompare {
	if c == nil {
		return nil
	}

	return &AttributionCompare{
		Index:       c.Index,
		Until:       date(c.Until),
		ReturnBp:    c.ReturnBP,
		Result:      toMoney(c.Result),
		IndexBp:     c.IndexBP,
		IndexResult: toMoney(c.IndexResult),
		RealBp:      c.RealBP,
	}
}

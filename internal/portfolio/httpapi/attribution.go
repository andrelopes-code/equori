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
	out := AttributionYear{Year: y.Year, From: date(y.From), To: date(y.To), PeriodBp: y.PeriodBP}

	if y.Missing != nil {
		missing := make([]string, len(y.Missing))
		for i, code := range y.Missing {
			missing[i] = string(code)
		}

		out.Missing = &missing

		return out
	}

	result, other := toMoney(*y.Result), toMoney(*y.Other)
	items := make([]AttributionItem, len(y.Items))

	for i, it := range y.Items {
		items[i] = AttributionItem{
			Instrument: string(it.Instrument),
			Result:     toMoney(it.Result),
			ReturnBp:   it.ReturnBP,
		}
		if it.StaleSince != nil {
			d := date(*it.StaleSince)
			items[i].StaleSince = &d
		}
	}

	out.Result, out.Other, out.Items = &result, &other, &items

	return out
}

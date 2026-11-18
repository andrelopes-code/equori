package httpapi

import (
	"context"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listFundReports(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (FundReportList, error) {
	list, err := s.svc.FundReports(ctx, r.URL.Query().Get("code"))
	if err != nil {
		return FundReportList{}, err
	}

	items := make([]FundReport, len(list.Items))
	for i, f := range list.Items {
		periods := make([]FundReportPeriod, len(f.Periods))
		for j, p := range f.Periods {
			periods[j] = fundReportPeriod(p)
		}

		items[i] = FundReport{
			Source:     f.Source,
			SourceUrl:  f.SourceURL,
			Exchange:   f.Exchange,
			Code:       f.Code,
			Currency:   f.Currency,
			Identifier: f.Identifier,
			Name:       f.Name,
			Segment:    f.Segment,
			Periods:    periods,
		}
	}

	candidates := make([]FundReportCandidate, len(list.Candidates))
	for i, c := range list.Candidates {
		candidates[i] = FundReportCandidate{
			Source:     c.Source,
			Identifier: c.Identifier,
			Name:       c.Name,
			Segment:    c.Segment,
		}
	}

	return FundReportList{Items: items, Candidates: candidates}, nil
}

func fundReportPeriod(p domain.FundReportPeriod) FundReportPeriod {
	return FundReportPeriod{
		Period:            openapi_types.Date{Time: p.Period},
		Delivered:         date(p.Delivered),
		NetAssets:         p.NetAssets,
		Holders:           p.Holders,
		Units:             p.Units,
		UnitBookValue:     p.UnitBookValue,
		AdminFee:          p.AdminFee,
		MonthYield:        p.MonthYield,
		MonthAmortization: p.MonthAmortization,
	}
}

func date(t *time.Time) *openapi_types.Date {
	if t == nil {
		return nil
	}

	return &openapi_types.Date{Time: *t}
}

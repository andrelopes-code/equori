package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

const (
	defaultPercentOfIndexBP = 10000
	defaultSpreadBP         = 0
)

func (s *Server) putInstrumentTerms(
	ctx context.Context, r *http.Request, b PutInstrumentTermsJSONRequestBody,
) (FixedIncomeTerms, error) {
	t := domain.Terms{
		IssuedOn:         b.IssuedOn.Time,
		MaturesOn:        b.MaturesOn.Time,
		DayCount:         string(b.DayCount),
		FaceValue:        b.FaceValue,
		PercentOfIndexBP: defaultPercentOfIndexBP,
		SpreadBP:         defaultSpreadBP,
	}
	if b.IndexId != nil {
		t.IndexID = *b.IndexId
	}

	if b.PercentOfIndexBp != nil {
		t.PercentOfIndexBP = *b.PercentOfIndexBp
	}

	if b.SpreadBp != nil {
		t.SpreadBP = *b.SpreadBp
	}

	out, err := s.svc.PutTerms(ctx, r.PathValue("code"), t)
	if err != nil {
		return FixedIncomeTerms{}, err
	}

	return toTermsAPI(out), nil
}

func (s *Server) getInstrumentTerms(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (FixedIncomeTerms, error) {
	t, err := s.svc.Terms(ctx, r.PathValue("code"))
	if err != nil {
		return FixedIncomeTerms{}, err
	}

	return toTermsAPI(t), nil
}

func toTermsAPI(t domain.Terms) FixedIncomeTerms {
	out := FixedIncomeTerms{
		IssuedOn: openapi_types.Date{
			Time: t.IssuedOn,
		},
		MaturesOn:        openapi_types.Date{Time: t.MaturesOn},
		PercentOfIndexBp: t.PercentOfIndexBP,
		SpreadBp:         t.SpreadBP,
		DayCount:         TermsDayCount(t.DayCount),
		FaceValue:        t.FaceValue,
	}
	if t.IndexID != "" {
		index := t.IndexID
		out.IndexId = &index
	}

	return out
}

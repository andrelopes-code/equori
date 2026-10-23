package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
)

const (
	defaultPercentOfIndexBP = 10000
	defaultSpreadBP         = 0
)

func (s *Server) PutInstrumentTerms(ctx context.Context, req PutInstrumentTermsRequestObject) (PutInstrumentTermsResponseObject, error) {
	b := req.Body
	t := domain.Terms{
		IssuedOn: b.IssuedOn.Time, MaturesOn: b.MaturesOn.Time, DayCount: string(b.DayCount), FaceValue: b.FaceValue,
		PercentOfIndexBP: defaultPercentOfIndexBP, SpreadBP: defaultSpreadBP,
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
	out, err := s.svc.PutTerms(ctx, req.Code, t)
	if err != nil {
		return nil, err
	}
	return PutInstrumentTerms200JSONResponse(toTermsAPI(out)), nil
}

func (s *Server) GetInstrumentTerms(ctx context.Context, req GetInstrumentTermsRequestObject) (GetInstrumentTermsResponseObject, error) {
	t, err := s.svc.Terms(ctx, req.Code)
	if err != nil {
		return nil, err
	}
	return GetInstrumentTerms200JSONResponse(toTermsAPI(t)), nil
}

func toTermsAPI(t domain.Terms) FixedIncomeTerms {
	out := FixedIncomeTerms{
		IssuedOn: openapi_types.Date{Time: t.IssuedOn}, MaturesOn: openapi_types.Date{Time: t.MaturesOn},
		PercentOfIndexBp: t.PercentOfIndexBP, SpreadBp: t.SpreadBP, DayCount: TermsDayCount(t.DayCount), FaceValue: t.FaceValue,
	}
	if t.IndexID != "" {
		index := t.IndexID
		out.IndexId = &index
	}
	return out
}

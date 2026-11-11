package httpapi

import (
	"context"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) ProbeQuote(ctx context.Context, req ProbeQuoteRequestObject) (ProbeQuoteResponseObject, error) {
	b := req.Body

	in := domain.Instrument{
		Code: money.Currency(b.Code), Type: string(b.Type), QuoteCurrency: money.Currency(b.QuoteCurrency),
	}
	if b.Exchange != nil {
		in.Exchange = *b.Exchange
	}

	if b.Symbols != nil {
		in.Symbols = *b.Symbols
	}

	res, err := s.svc.ProbeQuote(ctx, in)
	if err != nil {
		return nil, err
	}

	out := ProbeResult{Quotes: make([]ProbeQuote, len(res.Quotes)), Available: res.Available}
	if out.Available == nil {
		out.Available = []string{}
	}

	for i, q := range res.Quotes {
		out.Quotes[i] = probeQuoteOf(q)
	}

	return ProbeQuote200JSONResponse(out), nil
}

func probeQuoteOf(q domain.ProbeQuote) ProbeQuote {
	out := ProbeQuote{Source: q.Source}

	if q.Date != nil {
		date, value := openapi_types.Date{Time: *q.Date}, q.Value.Reduced().String()
		out.Date, out.Value = &date, &value
	}

	if q.Error != "" {
		out.Error = &q.Error
	}

	return out
}

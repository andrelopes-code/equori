package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) DefineInstrument(ctx context.Context, req DefineInstrumentRequestObject) (DefineInstrumentResponseObject, error) {
	b := req.Body
	in := domain.Instrument{Code: money.Currency(b.Code), Type: string(b.Type), Scale: b.Scale, Name: b.Name, QuoteCurrency: money.Currency(b.QuoteCurrency)}
	if b.Exchange != nil {
		in.Exchange = string(*b.Exchange)
	}
	out, err := s.svc.DefineInstrument(ctx, in)
	if err != nil {
		return nil, err
	}
	location := BaseURL + "/instruments/" + string(out.Code)
	return DefineInstrument201JSONResponse{Body: toInstrumentAPI(out), Headers: DefineInstrument201ResponseHeaders{Location: &location}}, nil
}

func (s *Server) ListInstruments(ctx context.Context, req ListInstrumentsRequestObject) (ListInstrumentsResponseObject, error) {
	typ := ""
	if req.Params.Type != nil {
		typ = string(*req.Params.Type)
	}
	ins, err := s.svc.ListInstruments(ctx, typ)
	if err != nil {
		return nil, err
	}
	items := make([]Instrument, len(ins))
	for i, in := range ins {
		items[i] = toInstrumentAPI(in)
	}
	return ListInstruments200JSONResponse{Items: items}, nil
}

func (s *Server) GetInstrument(ctx context.Context, req GetInstrumentRequestObject) (GetInstrumentResponseObject, error) {
	in, err := s.svc.Instrument(ctx, req.Code)
	if err != nil {
		return nil, err
	}
	return GetInstrument200JSONResponse(toInstrumentAPI(in)), nil
}

func toInstrumentAPI(in domain.Instrument) Instrument {
	out := Instrument{Code: string(in.Code), Type: InstrumentType(in.Type), Scale: in.Scale, Name: in.Name}
	if in.QuoteCurrency != "" {
		q := string(in.QuoteCurrency)
		out.QuoteCurrency = &q
	}
	if in.Exchange != "" {
		e := InstrumentExchange(in.Exchange)
		out.Exchange = &e
	}
	return out
}

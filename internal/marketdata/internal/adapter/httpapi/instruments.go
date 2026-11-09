package httpapi

import (
	"context"
	"maps"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) DefineInstrument(ctx context.Context, req DefineInstrumentRequestObject) (DefineInstrumentResponseObject, error) {
	b := req.Body

	in := domain.Instrument{Code: money.Currency(b.Code), Type: string(b.Type), Scale: b.Scale, Name: b.Name, QuoteCurrency: money.Currency(b.QuoteCurrency)}
	if b.Exchange != nil {
		in.Exchange = string(*b.Exchange)
	}

	if b.Subtype != nil {
		in.Subtype = string(*b.Subtype)
	}

	if b.Symbols != nil {
		in.Symbols = *b.Symbols
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

	cov, err := s.svc.Coverage(ctx, in)
	if err != nil {
		return nil, err
	}

	out := toInstrumentAPI(in)
	out.Coverage = coverageOf(cov)

	return GetInstrument200JSONResponse(out), nil
}

func (s *Server) RequestInstrumentHistory(ctx context.Context, req RequestInstrumentHistoryRequestObject) (RequestInstrumentHistoryResponseObject, error) {
	if err := s.svc.RequestHistory(ctx, req.Code, req.Body.From.Time); err != nil {
		return nil, err
	}

	return RequestInstrumentHistory202Response{}, nil
}

func (s *Server) EditInstrument(ctx context.Context, req EditInstrumentRequestObject) (EditInstrumentResponseObject, error) {
	b := req.Body

	var exchange, subtype string
	if b.Exchange != nil {
		exchange = *b.Exchange
	}

	if b.Subtype != nil {
		subtype = *b.Subtype
	}

	var symbols map[string]string
	if b.Symbols != nil {
		symbols = map[string]string{}
		maps.Copy(symbols, *b.Symbols)
	}

	out, err := s.svc.EditInstrument(ctx, req.Code, b.Name, exchange, subtype, symbols)
	if err != nil {
		return nil, err
	}

	return EditInstrument200JSONResponse(toInstrumentAPI(out)), nil
}

func toInstrumentAPI(in domain.Instrument) Instrument {
	out := Instrument{Code: string(in.Code), Type: InstrumentType(in.Type), Scale: in.Scale, Name: in.Name}
	if in.QuoteCurrency != "" {
		q := string(in.QuoteCurrency)
		out.QuoteCurrency = &q
	}

	if in.Exchange != "" {
		e := in.Exchange
		out.Exchange = &e
	}

	if in.Subtype != "" {
		sub := in.Subtype
		out.Subtype = &sub
	}

	if len(in.Symbols) > 0 {
		symbols := InstrumentSymbols(in.Symbols)
		out.Symbols = &symbols
	}

	return out
}

func coverageOf(c domain.Coverage) *InstrumentCoverage {
	out := &InstrumentCoverage{
		First: optionalDate(c.First), Last: optionalDate(c.Last), Count: c.Count, Stale: c.Stale,
		Sources: make([]InstrumentSourceCoverage, len(c.Sources)),
	}

	for i, sc := range c.Sources {
		out.Sources[i] = InstrumentSourceCoverage{
			Id: sc.ID, Enabled: sc.Enabled, Official: sc.Official, First: optionalDate(sc.First), Last: optionalDate(sc.Last),
		}

		if h := sc.History; h != nil {
			out.Sources[i].History = &InstrumentHistory{From: openapi_types.Date{Time: h.From}, Done: h.Done}
			if h.Error != "" {
				out.Sources[i].History.Error = &h.Error
			}
		}
	}

	return out
}

func optionalDate(t *time.Time) *openapi_types.Date {
	if t == nil {
		return nil
	}

	return &openapi_types.Date{Time: *t}
}

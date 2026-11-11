package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) defineInstrument(
	ctx context.Context, _ *http.Request, b DefineInstrumentJSONRequestBody,
) (Instrument, string, error) {
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
		return Instrument{}, "", err
	}

	return toInstrumentAPI(out), BaseURL + "/instruments/" + string(out.Code), nil
}

func (s *Server) listInstruments(ctx context.Context, r *http.Request, _ httpserver.None) (InstrumentList, error) {
	params, err := httpserver.Query[ListInstrumentsParams](r)
	if err != nil {
		return InstrumentList{}, err
	}

	typ := ""
	if params.Type != nil {
		typ = string(*params.Type)
	}

	ins, err := s.svc.ListInstruments(ctx, typ)
	if err != nil {
		return InstrumentList{}, err
	}

	items := make([]Instrument, len(ins))
	for i, in := range ins {
		items[i] = toInstrumentAPI(in)
	}

	return InstrumentList{Items: items}, nil
}

func (s *Server) getInstrument(ctx context.Context, r *http.Request, _ httpserver.None) (Instrument, error) {
	in, err := s.svc.Instrument(ctx, r.PathValue("code"))
	if err != nil {
		return Instrument{}, err
	}

	cov, err := s.svc.Coverage(ctx, in)
	if err != nil {
		return Instrument{}, err
	}

	out := toInstrumentAPI(in)
	out.Coverage = coverageOf(cov)

	return out, nil
}

// requestInstrumentHistory is a custom handler: the success status is 202 with no body.
func (s *Server) requestInstrumentHistory(w http.ResponseWriter, r *http.Request) {
	var b RequestInstrumentHistoryJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))

		return
	}

	if err := s.svc.RequestHistory(r.Context(), r.PathValue("code"), b.From.Time); err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) editInstrument(
	ctx context.Context, r *http.Request, b EditInstrumentJSONRequestBody,
) (Instrument, error) {
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

	out, err := s.svc.EditInstrument(ctx, r.PathValue("code"), b.Name, exchange, subtype, symbols)
	if err != nil {
		return Instrument{}, err
	}

	return toInstrumentAPI(out), nil
}

func (s *Server) deleteInstrument(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (httpserver.None, error) {
	if err := s.svc.DeleteInstrument(ctx, r.PathValue("code")); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
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

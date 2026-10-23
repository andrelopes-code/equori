package httpapi

import (
	"context"
	"errors"
	"io"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// maxImportBytes stays under the default request body limit of 1 MiB.
const maxImportBytes = 1 << 20

func (s *Server) RecordPrice(ctx context.Context, req RecordPriceRequestObject) (RecordPriceResponseObject, error) {
	b := req.Body
	value, err := money.ParseRate(b.Value)
	if err != nil {
		return nil, &domain.FieldError{Field: "value", Message: "must be a positive decimal with at most 12 decimals"}
	}
	p := domain.Price{Instrument: money.Currency(b.Instrument), Quote: money.Currency(b.QuoteInstrument), Date: b.Date.Time, Value: value, Source: domain.SourceManual}
	if err := s.svc.RecordPrices(ctx, []domain.Price{p}); err != nil {
		return nil, err
	}
	return RecordPrice201JSONResponse(toPriceAPI(p)), nil
}

func (s *Server) ImportPrices(ctx context.Context, req ImportPricesRequestObject) (ImportPricesResponseObject, error) {
	for {
		part, err := req.Body.NextPart()
		if errors.Is(err, io.EOF) {
			return nil, &domain.FieldError{Field: "file", Message: "is required"}
		}
		if err != nil {
			return nil, err
		}
		if part.FormName() != "file" {
			continue
		}
		content, err := io.ReadAll(io.LimitReader(part, maxImportBytes))
		if err != nil {
			return nil, err
		}
		n, err := s.svc.ImportPrices(ctx, content)
		if err != nil {
			return nil, err
		}
		return ImportPrices200JSONResponse{Recorded: n}, nil
	}
}

func (s *Server) ListPrices(ctx context.Context, req ListPricesRequestObject) (ListPricesResponseObject, error) {
	p := req.Params
	ps, err := s.svc.ListPrices(ctx, money.Currency(p.Instrument), money.Currency(p.QuoteInstrument), p.From.Time, p.To.Time)
	if err != nil {
		return nil, err
	}
	items := make([]Price, len(ps))
	for i, x := range ps {
		items[i] = toPriceAPI(x)
	}
	return ListPrices200JSONResponse{Items: items}, nil
}

func toPriceAPI(p domain.Price) Price {
	return Price{
		Instrument: string(p.Instrument), QuoteInstrument: string(p.Quote), Date: openapi_types.Date{Time: p.Date},
		Value: p.Value.Reduced().String(), Source: p.Source,
	}
}

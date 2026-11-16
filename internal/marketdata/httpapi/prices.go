package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// maxImportBytes stays under the default request body limit of 1 MiB.
const maxImportBytes = 1 << 20

const rateMessage = "value must be a positive decimal with at most 12 decimals and 18 integer digits"

func (s *Server) recordPrice(
	ctx context.Context, _ *http.Request, b RecordPriceJSONRequestBody,
) (Price, error) {
	value, err := money.ParseRate(b.Value)
	if err != nil {
		return Price{}, &domain.FieldError{
			Field:   "value",
			Message: "must be a positive decimal with at most 12 decimals",
		}
	}

	p := domain.Price{
		Instrument: money.Currency(b.Instrument),
		Quote:      money.Currency(b.QuoteInstrument),
		Date:       b.Date.Time,
		Value:      value,
		Source:     domain.SourceManual,
	}
	if err := s.svc.RecordPrices(ctx, auth.MustBooksID(ctx), []domain.Price{p}); err != nil {
		return Price{}, err
	}

	return toPriceAPI(p), nil
}

// importPrices is a custom handler: the request body is multipart.
func (s *Server) importPrices(w http.ResponseWriter, r *http.Request) {
	reader, err := r.MultipartReader()
	if err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode multipart body: %w", err))

		return
	}

	out, err := s.importPricesFile(r.Context(), reader)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(out); err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = buf.WriteTo(w)
}

func (s *Server) importPricesFile(
	ctx context.Context,
	body *multipart.Reader,
) (PriceImport, error) {
	for {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			return PriceImport{}, &domain.FieldError{Field: "file", Message: "is required"}
		}

		if err != nil {
			return PriceImport{}, err
		}

		if part.FormName() != "file" {
			continue
		}

		content, err := io.ReadAll(io.LimitReader(part, maxImportBytes))
		if err != nil {
			return PriceImport{}, err
		}

		n, err := s.svc.ImportPrices(ctx, auth.MustBooksID(ctx), content)
		if err != nil {
			return PriceImport{}, err
		}

		return PriceImport{Recorded: n}, nil
	}
}

func (s *Server) recordInstrumentPrices(
	ctx context.Context, r *http.Request, b RecordInstrumentPricesJSONRequestBody,
) (InstrumentPricesResult, error) {
	points := make([]domain.PricePoint, len(b.Prices))
	for i, p := range b.Prices {
		value, err := money.ParseRate(p.Value)
		if err != nil {
			return InstrumentPricesResult{}, &domain.FieldError{
				Field:   fmt.Sprintf("prices[%d]", i),
				Message: rateMessage,
			}
		}

		points[i] = domain.PricePoint{Date: p.Date.Time, Value: value}
	}

	counts, err := s.svc.RecordInstrumentPrices(
		ctx,
		r.PathValue("code"),
		money.Currency(b.QuoteInstrument),
		points,
		b.DryRun != nil && *b.DryRun,
	)
	if err != nil {
		return InstrumentPricesResult{}, err
	}

	return InstrumentPricesResult{
		New:       counts.New,
		Replaced:  counts.Replaced,
		Unchanged: counts.Unchanged,
		BelowFeed: counts.BelowFeed,
	}, nil
}

func (s *Server) listPrices(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (PriceList, error) {
	p, err := httpserver.Query[ListPricesParams](r)
	if err != nil {
		return PriceList{}, err
	}

	ps, err := s.svc.ListPrices(
		ctx,
		money.Currency(p.Instrument),
		money.Currency(p.QuoteInstrument),
		p.From.Time,
		p.To.Time,
	)
	if err != nil {
		return PriceList{}, err
	}

	items := make([]Price, len(ps))
	for i, x := range ps {
		items[i] = toPriceAPI(x)
	}

	return PriceList{Items: items}, nil
}

func toPriceAPI(p domain.Price) Price {
	return Price{
		Instrument: string(
			p.Instrument,
		),
		QuoteInstrument: string(p.Quote),
		Date:            openapi_types.Date{Time: p.Date},
		Value:           p.Value.Reduced().String(),
		Source:          p.Source,
	}
}

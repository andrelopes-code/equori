package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) listInstrumentQuotes(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (InstrumentQuoteList, error) {
	p, err := httpserver.Query[ListInstrumentQuotesParams](r)
	if err != nil {
		return InstrumentQuoteList{}, err
	}

	quotes, err := s.svc.ListInstrumentQuotes(ctx, money.Currency(p.Base))
	if err != nil {
		return InstrumentQuoteList{}, err
	}

	instruments, err := s.svc.ListInstruments(ctx, "")
	if err != nil {
		return InstrumentQuoteList{}, err
	}

	booksID := auth.MustBooksID(ctx)
	visible := map[money.Currency]bool{}

	for _, in := range instruments {
		visible[in.Code] = in.VisibleTo(booksID)
	}

	items := make([]InstrumentQuote, 0, len(quotes))

	for _, q := range quotes {
		if visible[q.Instrument] {
			items = append(items, toInstrumentQuoteAPI(q))
		}
	}

	return InstrumentQuoteList{Items: items}, nil
}

func toInstrumentQuoteAPI(q domain.InstrumentQuote) InstrumentQuote {
	return InstrumentQuote{
		Instrument:      string(q.Instrument),
		QuoteInstrument: string(q.Quote),
		Last:            toQuotePointAPI(q.Last),
		References: QuoteReferences{
			Week:       toQuotePointAPI(q.References.Week),
			Month:      toQuotePointAPI(q.References.Month),
			Quarter:    toQuotePointAPI(q.References.Quarter),
			Year:       toQuotePointAPI(q.References.Year),
			YearToDate: toQuotePointAPI(q.References.YearToDate),
		},
		Trend: toTrendAPI(q.Trend),
	}
}

// toTrendAPI writes the value of each trend date; a date before the first price is null.
func toTrendAPI(points []*domain.QuotePoint) []*string {
	out := make([]*string, len(points))
	for i, p := range points {
		if p != nil {
			value := p.Value.Reduced().String()
			out[i] = &value
		}
	}

	return out
}

func toQuotePointAPI(p *domain.QuotePoint) *QuotePoint {
	if p == nil {
		return nil
	}

	return &QuotePoint{
		Date:  openapi_types.Date{Time: p.Date},
		Value: p.Value.Reduced().String(),
	}
}

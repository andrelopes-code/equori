package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
)

func (s *Server) SearchInstrumentCatalog(ctx context.Context, req SearchInstrumentCatalogRequestObject) (SearchInstrumentCatalogResponseObject, error) {
	res, err := s.svc.SearchCatalog(ctx, req.Params.Q)
	if err != nil {
		return nil, err
	}

	out := CatalogSearch{Items: make([]CatalogListing, len(res.Items)), Unavailable: res.Unavailable}
	if out.Unavailable == nil {
		out.Unavailable = []string{}
	}

	for i, l := range res.Items {
		out.Items[i] = listingOf(l)
	}

	return SearchInstrumentCatalog200JSONResponse(out), nil
}

func listingOf(l domain.Listing) CatalogListing {
	out := CatalogListing{
		Code: string(l.Code), Name: l.Name, Exchange: l.Exchange, QuoteCurrency: string(l.QuoteCurrency),
		Symbol: l.Symbol, Source: l.Source, Defined: l.Defined,
	}
	if l.Type != "" {
		typ := InstrumentType(l.Type)
		out.Type = &typ
	}

	return out
}

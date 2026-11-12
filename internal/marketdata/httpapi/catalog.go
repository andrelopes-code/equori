package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) searchInstrumentCatalog(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (CatalogSearch, error) {
	params, err := httpserver.Query[SearchInstrumentCatalogParams](r)
	if err != nil {
		return CatalogSearch{}, err
	}

	res, err := s.svc.SearchCatalog(ctx, params.Q)
	if err != nil {
		return CatalogSearch{}, err
	}

	out := CatalogSearch{
		Items:       make([]CatalogListing, len(res.Items)),
		Unavailable: res.Unavailable,
	}
	if out.Unavailable == nil {
		out.Unavailable = []string{}
	}

	for i, l := range res.Items {
		out.Items[i] = listingOf(l)
	}

	return out, nil
}

func listingOf(l domain.Listing) CatalogListing {
	out := CatalogListing{
		Code: string(
			l.Code,
		),
		Name:          l.Name,
		Exchange:      l.Exchange,
		QuoteCurrency: string(l.QuoteCurrency),
		Symbol:        l.Symbol,
		Source:        l.Source,
		Defined:       l.Defined,
	}
	if l.Type != "" {
		typ := InstrumentType(l.Type)
		out.Type = &typ
	}

	return out
}

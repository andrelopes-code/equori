package marketdata

import (
	"cmp"
	"context"
	"slices"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/internal/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	catalogMinQuery = 2
	catalogLimit    = 20
)

// catalogAnswer is what one enabled catalog source returned for a search.
type catalogAnswer struct {
	id       string
	listings []domain.Listing
	err      error
}

// SearchCatalog lists the instruments the enabled sources can quote whose code or name contains
// query (A222 MQ29). A source that fails or passes CatalogBound is named in Unavailable.
func (m *Module) SearchCatalog(ctx context.Context, query string) (domain.CatalogResult, error) {
	query = strings.TrimSpace(query)
	if utf8.RuneCountInString(query) < catalogMinQuery {
		return domain.CatalogResult{}, &domain.FieldError{Field: "q", Message: "must have at least 2 characters"}
	}

	on, err := m.enabledFeeds(ctx)
	if err != nil {
		return domain.CatalogResult{}, err
	}

	instruments, err := m.ListInstruments(ctx, "")
	if err != nil {
		return domain.CatalogResult{}, err
	}

	var (
		out      domain.CatalogResult
		listings []domain.Listing
	)

	for _, a := range m.searchSources(ctx, on, query) {
		if a.err != nil {
			m.logFeed(ctx, a.err, "source", a.id)

			out.Unavailable = append(out.Unavailable, a.id)

			continue
		}

		listings = append(listings, a.listings...)
	}

	out.Items = mergeListings(listings, query, instruments)

	return out, nil
}

// searchSources runs Search of every enabled catalog source at once, answers in registry order.
func (m *Module) searchSources(ctx context.Context, on map[string]bool, query string) []catalogAnswer {
	var (
		answers []catalogAnswer
		sources []feed.Catalog
	)

	for _, src := range m.feeds.Sources {
		if c, ok := src.(feed.Catalog); ok && on[src.ID()] {
			answers = append(answers, catalogAnswer{id: src.ID()})
			sources = append(sources, c)
		}
	}

	var wg sync.WaitGroup

	for i, c := range sources {
		wg.Go(func() {
			ctx, cancel := context.WithTimeout(ctx, m.feeds.CatalogBound)
			defer cancel()

			found, err := c.Search(ctx, query, catalogLimit)

			answers[i].err = err
			for _, l := range found {
				answers[i].listings = append(answers[i].listings, domain.Listing{
					Code: l.Code, Name: l.Name, Type: l.Type, Exchange: l.Exchange,
					QuoteCurrency: l.QuoteCurrency, Symbol: l.Symbol, Source: answers[i].id,
				})
			}
		})
	}

	wg.Wait()

	return answers
}

// mergeListings drops the listings the instance cannot define, joins the ones that name the same
// instrument, puts the exact code first and keeps at most catalogLimit (A222 MQ29).
func mergeListings(listings []domain.Listing, query string, instruments []Instrument) []domain.Listing {
	defined := make(map[money.Currency]bool, len(instruments))
	currencies := make(map[money.Currency]bool)

	for _, in := range instruments {
		defined[in.Code] = true
		currencies[in.Code] = in.Type == domain.TypeCurrency
	}

	var out []domain.Listing

	for _, l := range listings {
		if !domain.ValidSecurityCode(l.Code) || (l.QuoteCurrency != "" && !currencies[l.QuoteCurrency]) {
			continue
		}

		if i := slices.IndexFunc(out, func(o domain.Listing) bool { return sameListing(o, l) }); i >= 0 {
			out[i] = fillListing(out[i], l)
			continue
		}

		l.Defined = defined[l.Code]
		out = append(out, l)
	}

	slices.SortStableFunc(out, func(a, b domain.Listing) int {
		return exactCode(b, query) - exactCode(a, query)
	})

	return out[:min(len(out), catalogLimit)]
}

// sameListing reports equal codes and exchanges with equal or one empty quote currency.
func sameListing(a, b domain.Listing) bool {
	return a.Code == b.Code && a.Exchange == b.Exchange &&
		(a.QuoteCurrency == b.QuoteCurrency || a.QuoteCurrency == "" || b.QuoteCurrency == "")
}

// fillListing gives a the name, type and quote currency it lacks from b.
func fillListing(a, b domain.Listing) domain.Listing {
	a.Name = cmp.Or(a.Name, b.Name)
	a.Type = cmp.Or(a.Type, b.Type)
	a.QuoteCurrency = cmp.Or(a.QuoteCurrency, b.QuoteCurrency)

	return a
}

func exactCode(l domain.Listing, query string) int {
	if strings.EqualFold(string(l.Code), query) {
		return 1
	}

	return 0
}

package marketdata

import (
	"context"
	"fmt"
	"maps"
	"slices"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/marketdata/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// storeSymbols replaces the symbols of code with symbols, inserted in key order.
func storeSymbols(
	ctx context.Context,
	q *postgres.Queries,
	code money.Currency,
	symbols map[string]string,
) error {
	if err := q.DeleteInstrumentSymbols(ctx, string(code)); err != nil {
		return fmt.Errorf("delete instrument symbols: %w", err)
	}

	for _, source := range slices.Sorted(maps.Keys(symbols)) {
		err := q.InsertInstrumentSymbol(ctx, postgres.InsertInstrumentSymbolParams{
			Instrument: string(code), Source: source, Symbol: symbols[source],
		})
		if err != nil {
			return fmt.Errorf("insert instrument symbol: %w", err)
		}
	}

	return nil
}

// checkSymbolSources accepts a key only when a registered source of that ID reads a symbol: a
// price source that overrides its symbol or a fund report source (FR15).
func (m *Module) checkSymbolSources(symbols map[string]string) error {
	for _, key := range slices.Sorted(maps.Keys(symbols)) {
		reads := slices.ContainsFunc(m.feeds.Sources, func(src feed.Source) bool {
			_, ok := src.(feed.SymbolOverride)
			return ok && src.ID() == key
		})
		if !reads && !m.isFundReportSource(key) && !m.isCompanyReportSource(key) {
			return &domain.FieldError{
				Field:   "symbols." + key,
				Message: "is not a source that reads a symbol",
			}
		}
	}

	return nil
}

// symbolsByInstrument returns the symbols of every instrument: instrument code, then source ID.
func (m *Module) symbolsByInstrument(ctx context.Context) (map[string]map[string]string, error) {
	rows, err := m.q.ListInstrumentSymbols(ctx)
	if err != nil {
		return nil, fmt.Errorf("list instrument symbols: %w", err)
	}

	out := make(map[string]map[string]string)

	for _, r := range rows {
		if out[r.Instrument] == nil {
			out[r.Instrument] = make(map[string]string)
		}

		out[r.Instrument][r.Source] = r.Symbol
	}

	return out, nil
}

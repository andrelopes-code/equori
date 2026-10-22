package marketdata

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/adapter/postgres"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ReconcileCurrencies inserts a currency instrument for every ISO 4217 code that has none.
// Existing rows are left unchanged.
func (m *Module) ReconcileCurrencies(ctx context.Context) error {
	all := money.Currencies()
	codes := make([]string, len(all))
	scales := make([]int16, len(all))
	names := make([]string, len(all))
	for i, c := range all {
		codes[i], scales[i], names[i] = string(c), int16(c.MinorUnits()), money.Name(c) //nolint:gosec // minor units are 0 to 4
	}
	err := m.q.InsertMissingCurrencies(ctx, postgres.InsertMissingCurrenciesParams{Codes: codes, Scales: scales, Names: names})
	if err != nil {
		return fmt.Errorf("insert missing currencies: %w", err)
	}
	return nil
}

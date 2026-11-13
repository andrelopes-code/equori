package marketdata

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/marketdata/feed"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// TypeFix is a stored share whose name says it is another type of security (A226).
type TypeFix struct {
	Code     money.Currency
	Name     string
	From, To string
}

// SuggestTypeFixes lists the stored shares whose name says another type, in code order. A source
// that states every security of an exchange as a share stored an ETF or a FII as one; the rule is
// the one the catalog search applies, `feed.SecurityType`.
func (m *Module) SuggestTypeFixes(ctx context.Context) ([]TypeFix, error) {
	shares, err := m.ListInstruments(ctx, "stock")
	if err != nil {
		return nil, err
	}

	var fixes []TypeFix

	for _, in := range shares {
		if to := feed.SecurityType(in.Exchange, in.Name, in.Type); to != in.Type {
			fixes = append(fixes, TypeFix{Code: in.Code, Name: in.Name, From: in.Type, To: to})
		}
	}

	return fixes, nil
}

// ApplyTypeFixes edits the type of each fix, keeping the rest of the instrument, then rebuilds
// the derived rows of the other modules once.
func (m *Module) ApplyTypeFixes(ctx context.Context, fixes []TypeFix) error {
	for _, f := range fixes {
		in, err := m.Instrument(ctx, string(f.Code))
		if err != nil {
			return err
		}

		if _, _, err := m.editInstrument(
			ctx, string(f.Code), f.To, in.Name, in.Exchange, in.Subtype, nil,
		); err != nil {
			return fmt.Errorf("fix the type of %s: %w", f.Code, err)
		}
	}

	if len(fixes) == 0 {
		return nil
	}

	if err := m.reclassified(ctx); err != nil {
		return fmt.Errorf("rebuild derived rows: %w", err)
	}

	return nil
}

package app

import (
	"context"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// QuoteWarning is a held instrument whose quote is stale or missing at a date (A222 MQ26).
type QuoteWarning struct {
	Instrument money.Currency
	Last       *time.Time
}

// QuoteWarnings lists, sorted by code, the instruments held at date whose quote is stale, has
// no price, or starts after date.
func (s *Service) QuoteWarnings(
	ctx context.Context,
	booksID int64,
	date time.Time,
) ([]QuoteWarning, error) {
	rows, err := s.repo.PositionsAt(ctx, booksID, date)
	if err != nil {
		return nil, err
	}

	var held []money.Currency
	for _, row := range rows {
		if row.Quantity != 0 {
			held = append(held, row.Instrument)
		}
	}

	slices.Sort(held)

	out := []QuoteWarning{}
	for _, code := range slices.Compact(held) {
		first, last, stale, err := s.md.QuoteState(ctx, code)
		if err != nil {
			return nil, err
		}

		if stale || first == nil || first.After(date) {
			out = append(out, QuoteWarning{Instrument: code, Last: last})
		}
	}

	return out, nil
}

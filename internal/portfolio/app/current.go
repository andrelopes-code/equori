package app

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// warm asks for the current quotes of codes when date is today of the book (A248 CQ18, CQ20).
func (s *Service) warm(ctx context.Context, date time.Time, codes []money.Currency) {
	if s.today(ctx, date) {
		s.md.WarmCurrent(ctx, codes)
	}
}

// value converts q at date: at today of the book with the current quotes, at any other date
// with the closes (A248 CQ20).
func (s *Service) value(
	ctx context.Context,
	q money.Money,
	to money.Currency,
	date time.Time,
) (money.Money, []Price, error) {
	if s.today(ctx, date) {
		return s.md.ConvertCurrent(ctx, q, to)
	}

	return s.md.Convert(ctx, q, to, date)
}

// positionCodes are the instruments Positions values: each row, base and in when set.
func positionCodes(rows []domain.PositionDay, base, in money.Currency) []money.Currency {
	codes := []money.Currency{base}
	if in != "" {
		codes = append(codes, in)
	}

	for _, row := range rows {
		codes = append(codes, row.Instrument)
	}

	return codes
}

func (s *Service) today(ctx context.Context, date time.Time) bool {
	return date.Equal(s.ledger.Today(ctx))
}

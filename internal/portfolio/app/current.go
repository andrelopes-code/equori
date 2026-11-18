package app

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// CurrentQuotes states the current quotes a total took (A248 CQ24).
type CurrentQuotes struct {
	Count    int
	Open     bool
	OldestAt time.Time
}

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

// currentQuotes summarizes the prices of a total; nil when none is a current quote.
func currentQuotes(prices []Price) *CurrentQuotes {
	var out *CurrentQuotes

	for _, p := range prices {
		if p.At == nil {
			continue
		}

		if out == nil {
			out = &CurrentQuotes{OldestAt: *p.At}
		}

		out.Count++
		out.Open = out.Open || p.Open

		if p.At.Before(out.OldestAt) {
			out.OldestAt = *p.At
		}
	}

	return out
}

// distinctPrices drops the repeats of (Instrument, Quote, Source, At): a member is converted
// more than once, so its price repeats.
func distinctPrices(prices []Price) []Price {
	type key struct {
		instrument, quote money.Currency
		source            string
		at                time.Time
	}

	seen := map[key]bool{}

	var out []Price

	for _, p := range prices {
		k := key{instrument: p.Instrument, quote: p.Quote, source: p.Source}
		if p.At != nil {
			k.at = *p.At
		}

		if !seen[k] {
			seen[k] = true
			out = append(out, p)
		}
	}

	return out
}

// pricesOf are the prices of every leg of every valued balance.
func pricesOf(balances []valuedBalance) []Price {
	var out []Price
	for _, v := range balances {
		out = append(out, v.prices...)
	}

	return out
}

// balanceCodes are the instruments valuedBalances values: each non-zero balance and in.
func balanceCodes(balances []AccountBalance, in money.Currency) []money.Currency {
	codes := []money.Currency{in}
	for _, b := range balances {
		if !b.Amount.IsZero() {
			codes = append(codes, b.Amount.Currency())
		}
	}

	return codes
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

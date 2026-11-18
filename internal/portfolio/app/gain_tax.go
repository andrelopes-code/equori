package app

import (
	"context"
	"math/big"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// GainTax returns the monthly tax on the gains of variable income of the tax year that starts in
// year, in the base currency it returns: the jurisdiction computes it from every sale up to the
// end of that year, so the losses carried from earlier years count (monthly gain tax design GT1
// to GT7).
func (s *Service) GainTax(
	ctx context.Context,
	booksID int64,
	year int,
) ([]domain.TaxMonth, money.Currency, error) {
	j, err := s.juris.For(ctx, booksID)
	if err != nil || j == nil {
		return nil, "", err
	}

	base, err := s.ledger.BaseCurrency(ctx, booksID)
	if err != nil {
		return nil, "", err
	}

	from, to := j.TaxYear(year)

	results, err := s.repo.RealizedResults(ctx, booksID, time.Time{}, to)
	if err != nil {
		return nil, "", err
	}

	trades, err := s.saleFacts(ctx, booksID)
	if err != nil {
		return nil, "", err
	}

	sales := make([]domain.TaxSale, 0, len(results))
	for _, r := range results {
		sales = append(sales, taxSale(r, trades[r.TransactionID]))
	}

	var out []domain.TaxMonth

	for _, m := range j.GainTax(sales) {
		if !m.Month.Before(from) && m.Month.Before(to) {
			out = append(out, m)
		}
	}

	return out, base, nil
}

// saleFacts are the trades of every brokerage of the book, by transaction.
func (s *Service) saleFacts(
	ctx context.Context,
	booksID int64,
) (map[uuid.UUID]domain.Trade, error) {
	accounts, err := s.ledger.AccountFacts(ctx, booksID)
	if err != nil {
		return nil, err
	}

	out := map[uuid.UUID]domain.Trade{}

	for _, a := range accounts {
		if a.Kind != kindBrokerage {
			continue
		}

		facts, err := s.ledger.InvestmentFacts(ctx, booksID, a.ID)
		if err != nil {
			return nil, err
		}

		for _, t := range facts.Trades {
			out[t.TransactionID] = t
		}
	}

	return out, nil
}

// taxSale is a realized result with the share of the gross value and of the tax withheld of its
// sale that its quantity holds (GT6).
func taxSale(r domain.RealizedResult, t domain.Trade) domain.TaxSale {
	return domain.TaxSale{
		Month:    r.Month,
		Kind:     r.Kind,
		TaxClass: r.TaxClass,
		Gross:    share(t.Gross, r.Quantity, t.Quantity),
		Result:   r.Result,
		Withheld: share(t.Taxes, r.Quantity, t.Quantity),
	}
}

// share is amount × part ÷ whole, rounded half to even; the whole amount when part is whole.
func share(amount, part, whole int64) int64 {
	if whole == 0 || part == whole {
		return amount
	}

	q, r := new(big.Int).QuoRem(
		new(big.Int).Mul(big.NewInt(amount), big.NewInt(part)),
		big.NewInt(whole),
		new(big.Int),
	)

	twice := new(big.Int).Mul(r, big.NewInt(2))
	if c := twice.Cmp(big.NewInt(whole)); c > 0 || (c == 0 && q.Bit(0) == 1) {
		q.Add(q, big.NewInt(1))
	}

	return q.Int64()
}

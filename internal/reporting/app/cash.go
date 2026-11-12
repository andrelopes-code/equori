package app

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// cashTotals is the cash view of [from, to] per category (CV1 to CV9).
func (s *Service) cashTotals(
	ctx context.Context,
	booksID int64,
	from, to time.Time,
) (Shares, error) {
	out, err := s.repo.OffCardTotals(ctx, booksID, from, to)
	if err != nil {
		return nil, err
	}

	facts, err := s.repo.CardFacts(ctx, booksID, to)
	if err != nil {
		return nil, err
	}

	payments, _ := allocate(facts)
	for _, p := range payments {
		if !p.date.Before(from) && !p.date.After(to) {
			add(out, p.shares)
		}
	}

	return out, nil
}

// cashMonthTotals is the cash view of [from, to] per category and per month, keyed by the
// first day of the month (CV1 to CV9).
func (s *Service) cashMonthTotals(
	ctx context.Context,
	booksID int64,
	from, to time.Time,
) (map[time.Time]Shares, error) {
	out, err := s.repo.OffCardMonthTotals(ctx, booksID, from, to)
	if err != nil {
		return nil, err
	}

	facts, err := s.repo.CardFacts(ctx, booksID, to)
	if err != nil {
		return nil, err
	}

	payments, _ := allocate(facts)
	for _, p := range payments {
		if p.date.Before(from) || p.date.After(to) {
			continue
		}

		m := firstOfMonth(p.date)
		if out[m] == nil {
			out[m] = Shares{}
		}

		add(out[m], p.shares)
	}

	return out, nil
}

// CategoryCashPayments lists the card amounts of one category in the cash view of [from, to],
// signed as its postings, in the order the payments apply (CV10).
func (s *Service) CategoryCashPayments(
	ctx context.Context,
	booksID int64,
	categoryID uuid.UUID,
	from, to time.Time,
) ([]CashPayment, string, error) {
	if days := int(to.Sub(from).Hours()/24) + 1; days < 1 || days > MaxCategoryDays {
		return nil, "", ErrInvalidCategoryRange
	}

	instrument, err := s.repo.AccountCurrency(ctx, booksID, categoryID)
	if err != nil {
		return nil, "", err
	}

	facts, err := s.repo.CardFacts(ctx, booksID, to)
	if err != nil {
		return nil, "", err
	}

	payments, _ := allocate(facts)

	var out []CashPayment
	for _, p := range payments {
		if v := p.shares[categoryID]; v != 0 && !p.date.Before(from) && !p.date.After(to) {
			out = append(
				out,
				CashPayment{
					Date:                 p.date,
					Amount:               v,
					CardID:               p.card,
					StatementID:          p.statement,
					StatementReference:   p.reference,
					PaymentTransactionID: p.transaction,
				},
			)
		}
	}

	return out, instrument, nil
}

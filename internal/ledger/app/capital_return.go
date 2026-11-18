package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// buildCapitalReturn builds a capital return of holding h of security into the cash account the
// order names, or the cash account of its brokerage (coverage row E-08).
func (s *Service) buildCapitalReturn(
	ctx context.Context,
	r Repository,
	o domain.ActionOrder,
	security domain.Account,
	h domain.Holding,
	base money.Currency,
) (domain.Transaction, error) {
	if o.CashAccountID == uuid.Nil {
		brokerage, err := s.lockBrokerage(ctx, r, security.BooksID, security.ParentID)
		if err != nil {
			return domain.Transaction{}, err
		}

		if o.CashAccountID, err = defaultCash(ctx, r, brokerage, base); err != nil {
			return domain.Transaction{}, err
		}
	}

	postings, action, err := domain.BuildCapitalReturn(o, h)
	if err != nil {
		return domain.Transaction{}, err
	}

	return domain.Transaction{
		BooksID:           security.BooksID,
		Date:              o.Date,
		Description:       o.Description,
		BalancingCurrency: base,
		Postings:          postings,
		CorporateAction:   &action,
	}, nil
}

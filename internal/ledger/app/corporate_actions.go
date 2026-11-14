package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

// RecordCorporateAction records a split, a reverse split or a bonus of one holding (A228 IO22).
func (s *Service) RecordCorporateAction(
	ctx context.Context,
	booksID int64,
	o domain.ActionOrder,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		t, err := s.buildCorporateAction(ctx, r, booksID, o)
		if err != nil {
			return err
		}

		created, err = s.insert(ctx, r, t)

		return err
	})

	return created, err
}

// buildCorporateAction resolves the holding of o, reads what it held the day before and builds
// the transaction.
func (s *Service) buildCorporateAction(
	ctx context.Context,
	r Repository,
	booksID int64,
	o domain.ActionOrder,
) (domain.Transaction, error) {
	base, err := baseCurrency(ctx, r, booksID)
	if err != nil {
		return domain.Transaction{}, err
	}

	security, err := s.actionHolding(ctx, r, booksID, &o)
	if err != nil {
		return domain.Transaction{}, err
	}

	if o.UnitCost != nil && o.CategoryID != uuid.Nil {
		if err := checkIncomeCategory(ctx, r, booksID, o.CategoryID); err != nil {
			return domain.Transaction{}, err
		}
	}

	h, err := s.lockHolding(ctx, r, booksID, security, base, o.Date.AddDate(0, 0, -1), uuid.Nil)
	if err != nil {
		return domain.Transaction{}, err
	}

	postings, action, err := domain.BuildCorporateAction(o, h, base)
	if err != nil {
		return domain.Transaction{}, err
	}

	return domain.Transaction{
		BooksID:           booksID,
		Date:              o.Date,
		Description:       o.Description,
		BalancingCurrency: base,
		Postings:          postings,
		CorporateAction:   &action,
	}, nil
}

// actionHolding resolves the holding named by o into o.AccountID; an action never creates it.
func (s *Service) actionHolding(
	ctx context.Context,
	r Repository,
	booksID int64,
	o *domain.ActionOrder,
) (domain.Account, error) {
	t := target{AccountID: o.AccountID, BrokerageID: o.BrokerageID, Instrument: o.Instrument}
	if err := checkTargetForm(t); err != nil {
		return domain.Account{}, err
	}

	if o.AccountID == uuid.Nil {
		_, holdingID, err := s.pairTarget(ctx, r, booksID, t)
		if err != nil {
			return domain.Account{}, err
		}

		o.AccountID = holdingID
	}

	security, err := loadAccount(ctx, r, booksID, o.AccountID, "account_id")
	if err != nil {
		return domain.Account{}, err
	}

	if !security.HoldsSecurity() {
		return domain.Account{}, fieldErr(
			"account_id",
			"must hold a security",
			domain.ErrValidation,
		)
	}

	return security, nil
}

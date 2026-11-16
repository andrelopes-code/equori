package app

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// RecordIncome records M18: income paid on a security into cash of the same brokerage
// (P8 amendment A70).
func (s *Service) RecordIncome(
	ctx context.Context,
	booksID int64,
	o domain.IncomeOrder,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		t, err := s.buildIncome(ctx, r, booksID, o)
		if err != nil {
			return err
		}

		created, err = s.insert(ctx, r, t)

		return err
	})

	return created, err
}

// buildIncome resolves o and builds its transaction.
func (s *Service) buildIncome(
	ctx context.Context,
	r Repository,
	booksID int64,
	o domain.IncomeOrder,
) (domain.Transaction, error) {
	base, err := baseCurrency(ctx, r, booksID)
	if err != nil {
		return domain.Transaction{}, err
	}

	if err := s.resolveIncome(ctx, r, booksID, &o, base); err != nil {
		return domain.Transaction{}, err
	}

	accts, err := s.tradeAccounts(ctx, r, booksID, o.WithheldCategoryID, "withheld_category_id")
	if err != nil {
		return domain.Transaction{}, err
	}

	o.WithheldCategoryID = accts.Taxes
	if err := s.defaultWithholding(ctx, booksID, &o); err != nil {
		return domain.Transaction{}, err
	}

	postings, income, err := domain.BuildIncome(o)
	if err != nil {
		return domain.Transaction{}, err
	}

	return domain.Transaction{
		BooksID:           booksID,
		Date:              o.Date,
		Description:       o.Description,
		BalancingCurrency: base,
		Postings:          postings,
		Income:            &income,
	}, nil
}

// resolveIncome resolves the security and cash accounts of o into o and checks its category.
func (s *Service) resolveIncome(
	ctx context.Context,
	r Repository,
	booksID int64,
	o *domain.IncomeOrder,
	base money.Currency,
) error {
	var err error

	o.AccountID, o.CashAccountID, err = s.resolveTarget(ctx, r, booksID, base, target{
		AccountID: o.AccountID, CashAccountID: o.CashAccountID, BrokerageID: o.BrokerageID,
		Instrument: o.Instrument, Create: true,
	})
	if err != nil {
		return err
	}

	if _, _, err := s.brokerageAccounts(
		ctx,
		r,
		booksID,
		o.AccountID,
		o.CashAccountID,
		base,
	); err != nil {
		return err
	}

	if err := checkIncomeCategory(ctx, r, booksID, o.CategoryID); err != nil {
		return err
	}

	return nil
}

// checkIncomeCategory requires id to name an income category.
func checkIncomeCategory(ctx context.Context, r Repository, booksID int64, id uuid.UUID) error {
	category, err := loadAccount(ctx, r, booksID, id, "category_id")
	if err != nil {
		return err
	}

	if category.Class != domain.ClassIncome {
		return fieldErr("category_id", "must be an income category", domain.ErrValidation)
	}

	return nil
}

// defaultWithholding sets the regional withholding of o when the request names none.
func (s *Service) defaultWithholding(
	ctx context.Context,
	booksID int64,
	o *domain.IncomeOrder,
) error {
	if o.Withheld != nil {
		return nil
	}

	profile, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return fmt.Errorf("read profile: %w", err)
	}

	o.DefaultWithholdingBP = s.defaults.WithholdingBP(profile.Region, string(o.Type), o.Date)

	return nil
}

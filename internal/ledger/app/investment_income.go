package app

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const basisPoints = 10000

// IncomeWithholding is the tax the book's region withholds on an income: RateBP, in basis points,
// of its gross.
type IncomeWithholding struct {
	RateBP   int
	Withheld money.Money
}

// RecordIncome records M18: income paid on a security into cash of the same brokerage
// (P8 amendment A70).
func (s *Service) RecordIncome(
	ctx context.Context,
	booksID int64,
	o domain.IncomeOrder,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error

		created, err = s.recordIncome(ctx, r, booksID, o)

		return err
	})

	return created, err
}

// EstimateIncomeWithholding returns the tax withheld on an income of grossMinor, in the base
// currency, that a record without withheld takes.
func (s *Service) EstimateIncomeWithholding(
	ctx context.Context,
	booksID int64,
	incomeType domain.IncomeType,
	date time.Time,
	grossMinor int64,
) (IncomeWithholding, error) {
	base, err := baseCurrency(ctx, s.repo, booksID)
	if err != nil {
		return IncomeWithholding{}, err
	}

	gross, err := money.New(grossMinor, base)
	if err != nil {
		return IncomeWithholding{}, err
	}

	rate, err := s.incomeRate(ctx, booksID, incomeType, date)
	if err != nil {
		return IncomeWithholding{}, err
	}

	withheld, err := money.Fraction(gross, int64(rate), basisPoints)
	if err != nil {
		return IncomeWithholding{}, err
	}

	return IncomeWithholding{RateBP: rate, Withheld: withheld}, nil
}

// recordIncome builds and inserts the transaction of o inside the transaction of r.
func (s *Service) recordIncome(
	ctx context.Context,
	r Repository,
	booksID int64,
	o domain.IncomeOrder,
) (domain.Transaction, error) {
	t, err := s.buildIncome(ctx, r, booksID, o)
	if err != nil {
		return domain.Transaction{}, err
	}

	return s.insert(ctx, r, t)
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

	rate, err := s.incomeRate(ctx, booksID, o.Type, o.Date)
	if err != nil {
		return err
	}

	o.DefaultWithholdingBP = rate

	return nil
}

// incomeRate is the rate, in basis points, the book's region withholds on an income of date.
func (s *Service) incomeRate(
	ctx context.Context,
	booksID int64,
	incomeType domain.IncomeType,
	date time.Time,
) (int, error) {
	profile, err := s.profiles.Profile(ctx, booksID)
	if err != nil {
		return 0, fmt.Errorf("read profile: %w", err)
	}

	return s.defaults.WithholdingBP(profile.Region, string(incomeType), date), nil
}

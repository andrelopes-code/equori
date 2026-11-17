package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type ForeignPurchase struct {
	AccountID, CategoryID, PayeeID, ForeignChargeCategoryID uuid.UUID
	Date                                                    time.Time
	Description                                             string
	Original                                                money.Money
	Rate                                                    money.Rate
	ForeignChargeRateBP                                     *int
	Statement                                               *domain.ReferenceMonth
}

func fieldErr(field, message string, err error) error {
	return &domain.FieldError{Field: field, Message: message, Err: err}
}

// RecordForeignPurchase records M11: amount = original × rate, the foreign charge on the amount, both
// charged to the account in the base currency (P8 amendment A66).
func (s *Service) RecordForeignPurchase(
	ctx context.Context,
	booksID int64,
	in ForeignPurchase,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		base, account, err := s.checkForeignPurchase(ctx, r, booksID, in)
		if err != nil {
			return err
		}

		bp, err := s.foreignChargeBP(ctx, r, booksID, in)
		if err != nil {
			return err
		}

		amount, err := money.Convert(in.Original, base, money.Leg{Rate: in.Rate})
		if err != nil {
			return fieldErr("rate", err.Error(), domain.ErrValidation)
		}

		charge, err := money.Fraction(amount, int64(bp), 10000)
		if err != nil {
			return err
		}

		postings, charges, err := s.foreignPurchasePostings(ctx, r, booksID, in, amount, charge)
		if err != nil {
			return err
		}

		if account.Kind != domain.KindCreditCard && in.Statement != nil {
			return fieldErr("statement", "is only allowed on a card account", domain.ErrValidation)
		}

		created, err = s.insert(ctx, r, domain.Transaction{
			BooksID: booksID, Date: in.Date, Description: in.Description, PayeeID: in.PayeeID,
			Postings: append(postings, charges...),
		})

		return err
	})

	return created, err
}

// BaseValue returns the value of an amount in the book's base currency at a date, from the
// stored prices (M5). An amount in the base currency is returned unchanged. Without a price
// the error wraps ErrPriceMissing on the field amount (M6).
func (s *Service) BaseValue(
	ctx context.Context,
	booksID int64,
	amount money.Money,
	date time.Time,
) (money.Money, error) {
	settings, err := s.repo.Settings(ctx, booksID)
	if err != nil {
		return money.Money{}, err
	}

	if amount.Currency() == settings.BaseCurrency {
		return amount, nil
	}

	c, err := s.prices.Convert(ctx, amount, settings.BaseCurrency, date)
	if errors.Is(err, ErrPriceMissing) {
		return money.Money{}, fieldErr("amount", err.Error(), ErrPriceMissing)
	}

	if err != nil {
		return money.Money{}, err
	}

	return c.Value, nil
}

func baseCurrency(ctx context.Context, r Repository, booksID int64) (money.Currency, error) {
	settings, err := r.Settings(ctx, booksID)
	return settings.BaseCurrency, err
}

func loadAccount(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
	field string,
) (domain.Account, error) {
	a, err := r.Account(ctx, booksID, id)
	if errors.Is(err, ErrNotFound) {
		return domain.Account{}, fieldErr(field, "unknown account", domain.ErrUnknownAccount)
	}

	return a, err
}

func (s *Service) expenseCategory(
	ctx context.Context,
	r Repository,
	booksID int64,
	id uuid.UUID,
	field string,
) error {
	a, err := loadAccount(ctx, r, booksID, id, field)
	if err != nil {
		return err
	}

	if a.Class != domain.ClassExpense {
		return fieldErr(field, "must be an expense category", domain.ErrValidation)
	}

	return nil
}

// checkForeignPurchase validates the account, the category and the original amount of in.
func (s *Service) checkForeignPurchase(
	ctx context.Context,
	r Repository,
	booksID int64,
	in ForeignPurchase,
) (money.Currency, domain.Account, error) {
	base, err := baseCurrency(ctx, r, booksID)
	if err != nil {
		return "", domain.Account{}, err
	}

	account, err := loadAccount(ctx, r, booksID, in.AccountID, "account_id")
	if err != nil {
		return "", domain.Account{}, err
	}

	if !account.IsBalance() || account.Instrument != base {
		return "", domain.Account{}, fieldErr(
			"account_id",
			"must be a balance account in the base currency "+string(base),
			domain.ErrCurrencyUnsupported,
		)
	}

	if err := s.expenseCategory(ctx, r, booksID, in.CategoryID, "category_id"); err != nil {
		return "", domain.Account{}, err
	}

	if _, err := money.ParseCurrency(
		string(in.Original.Currency()),
	); err != nil || in.Original.Currency() == base || in.Original.IsZero() ||
		in.Original.IsNegative() {
		return "", domain.Account{}, fieldErr(
			"original",
			"must be a positive amount of a currency other than "+string(base),
			domain.ErrValidation,
		)
	}

	return base, account, nil
}

// foreignChargeBP returns the foreign charge rate of in, in basis points.
func (s *Service) foreignChargeBP(
	ctx context.Context,
	r Repository,
	booksID int64,
	in ForeignPurchase,
) (int, error) {
	var (
		bp  int
		err error
	)

	if in.ForeignChargeRateBP != nil {
		bp = *in.ForeignChargeRateBP
	} else if bp, err = s.cardForeignChargeBP(ctx, r, booksID, in.AccountID); err != nil {
		return 0, err
	}

	if bp < 0 || bp > 10000 {
		return 0, fieldErr(
			"foreign_charge_rate_bp",
			"must be between 0 and 10000",
			domain.ErrValidation,
		)
	}

	return bp, nil
}

// foreignPurchasePostings builds the category postings and the card postings of in.
func (s *Service) foreignPurchasePostings(
	ctx context.Context,
	r Repository,
	booksID int64,
	in ForeignPurchase,
	amount, charge money.Money,
) ([]domain.Posting, []domain.Posting, error) {
	original, negOriginal := in.Original, in.Original.Neg()
	postings := []domain.Posting{{AccountID: in.CategoryID, Amount: amount, Original: &original}}

	charges := []domain.Posting{
		{
			AccountID: in.AccountID,
			Amount:    amount.Neg(),
			Original:  &negOriginal,
			Statement: in.Statement,
		},
	}
	if !charge.IsZero() {
		chargeCategory := in.ForeignChargeCategoryID
		if chargeCategory == uuid.Nil {
			taxes, err := r.SystemAccount(ctx, booksID, domain.RoleTaxes)
			if err != nil {
				return nil, nil, err
			}

			chargeCategory = taxes.ID
		} else if err := s.expenseCategory(ctx, r, booksID, chargeCategory, "foreign_charge_category_id"); err != nil {
			return nil, nil, err
		}

		postings = append(postings, domain.Posting{AccountID: chargeCategory, Amount: charge})
		charges = append(
			charges,
			domain.Posting{AccountID: in.AccountID, Amount: charge.Neg(), Statement: in.Statement},
		)
	}

	return postings, charges, nil
}

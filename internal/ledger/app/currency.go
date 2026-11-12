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

type Exchange struct {
	FromAccountID, ToAccountID, FeeCategoryID uuid.UUID
	Date                                      time.Time
	Description                               string
	FromAmount, ToAmount                      money.Money
	Fee                                       *money.Money
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

// Exchange records M12 between accounts of two currencies, one of them the base
// currency (P8 amendment A67).
func (s *Service) Exchange(
	ctx context.Context,
	booksID int64,
	in Exchange,
) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		from, to, base, err := loadExchangeAccounts(ctx, r, booksID, in)
		if err != nil {
			return err
		}

		fee, err := exchangeFee(in, base)
		if err != nil {
			return err
		}

		postings, err := exchangePostings(in, from, to, base, fee)
		if err != nil {
			return err
		}

		if !fee.IsZero() {
			if postings, err = s.withExchangeFee(ctx, r, booksID, in, postings, fee); err != nil {
				return err
			}
		}

		created, err = s.insert(
			ctx,
			r,
			domain.Transaction{
				BooksID:           booksID,
				Date:              in.Date,
				Description:       in.Description,
				BalancingCurrency: base,
				Postings:          postings,
			},
		)

		return err
	})

	return created, err
}

// loadExchangeAccounts loads the two accounts of an exchange and checks their currencies and
// amounts.
func loadExchangeAccounts(
	ctx context.Context,
	r Repository,
	booksID int64,
	in Exchange,
) (from, to domain.Account, base money.Currency, err error) {
	base, err = baseCurrency(ctx, r, booksID)
	if err != nil {
		return from, to, base, err
	}

	from, err = loadAccount(ctx, r, booksID, in.FromAccountID, "from_account_id")
	if err != nil {
		return from, to, base, err
	}

	to, err = loadAccount(ctx, r, booksID, in.ToAccountID, "to_account_id")
	if err != nil {
		return from, to, base, err
	}

	if err = checkExchangeAccounts(in, from, to, base); err != nil {
		return from, to, base, err
	}

	return from, to, base, nil
}

// checkExchangeAccounts checks the kinds, the currencies and the amounts of an exchange.
func checkExchangeAccounts(in Exchange, from, to domain.Account, base money.Currency) error {
	switch {
	case !from.IsBalance() || from.HoldsSecurity():
		return fieldErr(
			"from_account_id",
			"must be a balance account in a currency",
			domain.ErrValidation,
		)
	case !to.IsBalance() || to.HoldsSecurity():
		return fieldErr(
			"to_account_id",
			"must be a balance account in a currency",
			domain.ErrValidation,
		)
	case from.Instrument == to.Instrument:
		return fieldErr(
			"to_account_id",
			"must be in another currency than from_account_id",
			domain.ErrValidation,
		)
	case from.Instrument != base && to.Instrument != base:
		return fieldErr(
			"to_account_id",
			"one of the accounts must be in the base currency "+string(base),
			domain.ErrCurrencyUnsupported,
		)
	case in.FromAmount.Currency() != from.Instrument || in.FromAmount.IsZero() || in.FromAmount.IsNegative():
		return fieldErr(
			"from_amount",
			"must be a positive amount in "+string(from.Instrument),
			domain.ErrValidation,
		)
	case in.ToAmount.Currency() != to.Instrument || in.ToAmount.IsZero() || in.ToAmount.IsNegative():
		return fieldErr(
			"to_amount",
			"must be a positive amount in "+string(to.Instrument),
			domain.ErrValidation,
		)
	}

	return nil
}

// exchangeFee returns the fee of an exchange, zero when none is given.
func exchangeFee(in Exchange, base money.Currency) (money.Money, error) {
	fee, err := money.New(0, base)
	if err != nil {
		return money.Money{}, err
	}

	if in.Fee != nil {
		if in.Fee.Currency() != base || in.Fee.IsNegative() {
			return money.Money{}, fieldErr(
				"fee",
				"must be a non-negative amount in "+string(base),
				domain.ErrValidation,
			)
		}

		fee = *in.Fee
	}

	return fee, nil
}

// exchangePostings returns the two postings of an exchange, the fee debited in the base currency.
func exchangePostings(
	in Exchange,
	from, to domain.Account,
	base money.Currency,
	fee money.Money,
) ([]domain.Posting, error) {
	var postings []domain.Posting
	if from.Instrument == base {
		debit, err := in.FromAmount.Add(fee)
		if err != nil {
			return nil, err
		}

		postings = []domain.Posting{
			{AccountID: from.ID, Amount: debit.Neg()},
			{AccountID: to.ID, Amount: in.ToAmount, Weight: in.FromAmount},
		}
	} else {
		credit, err := in.ToAmount.Sub(fee)
		if err != nil {
			return nil, err
		}

		if credit.IsZero() || credit.IsNegative() {
			return nil, fieldErr("fee", "must be less than to_amount", domain.ErrValidation)
		}

		postings = []domain.Posting{
			{AccountID: from.ID, Amount: in.FromAmount.Neg(), Weight: in.ToAmount.Neg()},
			{AccountID: to.ID, Amount: credit},
		}
	}

	return postings, nil
}

// withExchangeFee inserts the fee posting between the two postings of the exchange.
func (s *Service) withExchangeFee(
	ctx context.Context,
	r Repository,
	booksID int64,
	in Exchange,
	postings []domain.Posting,
	fee money.Money,
) ([]domain.Posting, error) {
	feeCategory := in.FeeCategoryID
	if feeCategory == uuid.Nil {
		fees, err := r.SystemAccount(ctx, booksID, domain.RoleFees)
		if err != nil {
			return nil, err
		}

		feeCategory = fees.ID
	} else if err := s.expenseCategory(ctx, r, booksID, feeCategory, "fee_category_id"); err != nil {
		return nil, err
	}

	postings = []domain.Posting{postings[0], {AccountID: feeCategory, Amount: fee}, postings[1]}

	return postings, nil
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

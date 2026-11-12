package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type Exchange struct {
	FromAccountID, ToAccountID, FeeCategoryID uuid.UUID
	Date                                      time.Time
	Description                               string
	FromAmount, ToAmount                      money.Money
	Fee                                       *money.Money
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

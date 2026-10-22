package app

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
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
func (s *Service) RecordForeignPurchase(ctx context.Context, userID int64, in ForeignPurchase) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		base, err := baseCurrency(ctx, r, userID)
		if err != nil {
			return err
		}
		account, err := loadAccount(ctx, r, userID, in.AccountID, "account_id")
		if err != nil {
			return err
		}
		if !account.IsBalance() || account.Instrument != base {
			return fieldErr("account_id", "must be a balance account in the base currency "+string(base), domain.ErrCurrencyUnsupported)
		}
		if err := s.expenseCategory(ctx, r, userID, in.CategoryID, "category_id"); err != nil {
			return err
		}
		if _, err := money.ParseCurrency(string(in.Original.Currency())); err != nil || in.Original.Currency() == base || in.Original.IsZero() || in.Original.IsNegative() {
			return fieldErr("original", "must be a positive amount of a currency other than "+string(base), domain.ErrValidation)
		}
		var bp int
		if in.ForeignChargeRateBP != nil {
			bp = *in.ForeignChargeRateBP
		} else if bp, err = s.cardForeignChargeBP(ctx, r, userID, in.AccountID); err != nil {
			return err
		}
		if bp < 0 || bp > 10000 {
			return fieldErr("foreign_charge_rate_bp", "must be between 0 and 10000", domain.ErrValidation)
		}
		amount, err := money.Convert(in.Original, base, money.Leg{Rate: in.Rate})
		if err != nil {
			return fieldErr("rate", err.Error(), domain.ErrValidation)
		}
		charge, err := money.Fraction(amount, int64(bp), 10000)
		if err != nil {
			return err
		}
		original, negOriginal := in.Original, in.Original.Neg()
		postings := []domain.Posting{{AccountID: in.CategoryID, Amount: amount, Original: &original}}
		charges := []domain.Posting{{AccountID: in.AccountID, Amount: amount.Neg(), Original: &negOriginal, Statement: in.Statement}}
		if !charge.IsZero() {
			chargeCategory := in.ForeignChargeCategoryID
			if chargeCategory == uuid.Nil {
				taxes, err := r.SystemAccount(ctx, userID, domain.RoleTaxes)
				if err != nil {
					return err
				}
				chargeCategory = taxes.ID
			} else if err := s.expenseCategory(ctx, r, userID, chargeCategory, "foreign_charge_category_id"); err != nil {
				return err
			}
			postings = append(postings, domain.Posting{AccountID: chargeCategory, Amount: charge})
			charges = append(charges, domain.Posting{AccountID: in.AccountID, Amount: charge.Neg(), Statement: in.Statement})
		}
		if account.Kind != domain.KindCreditCard && in.Statement != nil {
			return fieldErr("statement", "is only allowed on a card account", domain.ErrValidation)
		}
		created, err = s.insert(ctx, r, domain.Transaction{
			UserID: userID, Date: in.Date, Description: in.Description, PayeeID: in.PayeeID,
			Postings: append(postings, charges...),
		})
		return err
	})
	return created, err
}

// Exchange records M12 between accounts of two currencies, one of them the base
// currency (P8 amendment A67).
func (s *Service) Exchange(ctx context.Context, userID int64, in Exchange) (domain.Transaction, error) {
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		base, err := baseCurrency(ctx, r, userID)
		if err != nil {
			return err
		}
		from, err := loadAccount(ctx, r, userID, in.FromAccountID, "from_account_id")
		if err != nil {
			return err
		}
		to, err := loadAccount(ctx, r, userID, in.ToAccountID, "to_account_id")
		if err != nil {
			return err
		}
		switch {
		case !from.IsBalance() || from.HoldsSecurity():
			return fieldErr("from_account_id", "must be a balance account in a currency", domain.ErrValidation)
		case !to.IsBalance() || to.HoldsSecurity():
			return fieldErr("to_account_id", "must be a balance account in a currency", domain.ErrValidation)
		case from.Instrument == to.Instrument:
			return fieldErr("to_account_id", "must be in another currency than from_account_id", domain.ErrValidation)
		case from.Instrument != base && to.Instrument != base:
			return fieldErr("to_account_id", "one of the accounts must be in the base currency "+string(base), domain.ErrCurrencyUnsupported)
		case in.FromAmount.Currency() != from.Instrument || in.FromAmount.IsZero() || in.FromAmount.IsNegative():
			return fieldErr("from_amount", "must be a positive amount in "+string(from.Instrument), domain.ErrValidation)
		case in.ToAmount.Currency() != to.Instrument || in.ToAmount.IsZero() || in.ToAmount.IsNegative():
			return fieldErr("to_amount", "must be a positive amount in "+string(to.Instrument), domain.ErrValidation)
		}
		fee, err := money.New(0, base)
		if err != nil {
			return err
		}
		if in.Fee != nil {
			if in.Fee.Currency() != base || in.Fee.IsNegative() {
				return fieldErr("fee", "must be a non-negative amount in "+string(base), domain.ErrValidation)
			}
			fee = *in.Fee
		}
		var postings []domain.Posting
		if from.Instrument == base {
			debit, err := in.FromAmount.Add(fee)
			if err != nil {
				return err
			}
			postings = []domain.Posting{
				{AccountID: from.ID, Amount: debit.Neg()},
				{AccountID: to.ID, Amount: in.ToAmount, Weight: in.FromAmount},
			}
		} else {
			credit, err := in.ToAmount.Sub(fee)
			if err != nil {
				return err
			}
			if credit.IsZero() || credit.IsNegative() {
				return fieldErr("fee", "must be less than to_amount", domain.ErrValidation)
			}
			postings = []domain.Posting{
				{AccountID: from.ID, Amount: in.FromAmount.Neg(), Weight: in.ToAmount.Neg()},
				{AccountID: to.ID, Amount: credit},
			}
		}
		if !fee.IsZero() {
			feeCategory := in.FeeCategoryID
			if feeCategory == uuid.Nil {
				fees, err := r.SystemAccount(ctx, userID, domain.RoleFees)
				if err != nil {
					return err
				}
				feeCategory = fees.ID
			} else if err := s.expenseCategory(ctx, r, userID, feeCategory, "fee_category_id"); err != nil {
				return err
			}
			postings = []domain.Posting{postings[0], {AccountID: feeCategory, Amount: fee}, postings[1]}
		}
		created, err = s.insert(ctx, r, domain.Transaction{UserID: userID, Date: in.Date, Description: in.Description, BalancingCurrency: base, Postings: postings})
		return err
	})
	return created, err
}

// ValuedBalance is BalanceAt valued in currency in with stored prices (P8 amendment
// A65); a parent whose sub-accounts hold several instruments sums their values.
func (s *Service) ValuedBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis Basis, in money.Currency) (Balance, Conversion, error) {
	if basis == "" {
		basis = BasisBooked
	}
	if _, err := money.ParseCurrency(string(in)); err != nil {
		return Balance{}, Conversion{}, fieldErr("value_in", "must be a supported currency", domain.ErrValidation)
	}
	if _, err := s.repo.Account(ctx, userID, accountID); err != nil {
		return Balance{}, Conversion{}, err
	}
	totals, err := s.repo.TreeBalancesByInstrument(ctx, userID, accountID, date, basis)
	if err != nil {
		return Balance{}, Conversion{}, err
	}
	value, err := money.New(0, in)
	if err != nil {
		return Balance{}, Conversion{}, err
	}
	out := Conversion{Value: value}
	var amount money.Money
	for _, code := range slices.Sorted(maps.Keys(totals)) {
		if amount, err = s.AmountOf(ctx, totals[code], code); err != nil {
			return Balance{}, Conversion{}, err
		}
		c := Conversion{Value: amount}
		if code != in {
			if amount.IsZero() {
				continue
			}
			c, err = s.prices.Convert(ctx, amount, in, date)
			if errors.Is(err, ErrPriceMissing) {
				return Balance{}, Conversion{}, fieldErr("value_in", err.Error(), ErrPriceMissing)
			}
			if err != nil {
				return Balance{}, Conversion{}, err
			}
		}
		if out.Value, err = out.Value.Add(c.Value); err != nil {
			return Balance{}, Conversion{}, fmt.Errorf("sum valued balances: %w", err)
		}
		out.Prices = append(out.Prices, c.Prices...)
	}
	b := Balance{AccountID: accountID, Date: date, Basis: basis, Amount: out.Value}
	if len(totals) == 1 {
		b.Amount = amount
	}
	return b, out, nil
}

func baseCurrency(ctx context.Context, r Repository, userID int64) (money.Currency, error) {
	settings, err := r.Settings(ctx, userID)
	return settings.BaseCurrency, err
}

func loadAccount(ctx context.Context, r Repository, userID int64, id uuid.UUID, field string) (domain.Account, error) {
	a, err := r.Account(ctx, userID, id)
	if errors.Is(err, ErrNotFound) {
		return domain.Account{}, fieldErr(field, "unknown account", domain.ErrUnknownAccount)
	}
	return a, err
}

func (s *Service) expenseCategory(ctx context.Context, r Repository, userID int64, id uuid.UUID, field string) error {
	a, err := loadAccount(ctx, r, userID, id, field)
	if err != nil {
		return err
	}
	if a.Class != domain.ClassExpense {
		return fieldErr(field, "must be an expense category", domain.ErrValidation)
	}
	return nil
}

// cardForeignChargeBP reads the rate from the first active card of the account; an account
// without an active card takes the default of the owner's region.
func (s *Service) cardForeignChargeBP(ctx context.Context, r Repository, userID int64, accountID uuid.UUID) (int, error) {
	cards, err := r.Cards(ctx, userID, accountID)
	if err != nil {
		return 0, err
	}
	for _, c := range cards {
		if c.Active {
			return c.ForeignChargeBP, nil
		}
	}
	return s.regionForeignChargeBP(ctx, userID)
}

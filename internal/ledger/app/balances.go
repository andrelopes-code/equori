package app

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// BalanceAt returns the balance in the account currency; a parent account sums its descendants.
func (s *Service) BalanceAt(ctx context.Context, booksID int64, accountID uuid.UUID, date time.Time, basis Basis) (Balance, error) {
	basis, err := normalizeBasis(basis)
	if err != nil {
		return Balance{}, err
	}

	a, err := s.repo.Account(ctx, booksID, accountID)
	if err != nil {
		return Balance{}, err
	}

	instruments, err := s.repo.TreeInstruments(ctx, booksID, accountID)
	if err != nil {
		return Balance{}, err
	}

	if len(instruments) > 1 {
		return Balance{}, ErrMixedInstruments
	}

	total, err := s.repo.BalanceAt(ctx, booksID, accountID, date, basis)
	if err != nil {
		return Balance{}, err
	}

	amount, err := s.AmountOf(ctx, total, a.Instrument)
	if err != nil {
		return Balance{}, err
	}

	return Balance{AccountID: accountID, Date: date, Basis: basis, Amount: amount}, nil
}

func normalizeBasis(basis Basis) (Basis, error) {
	switch basis {
	case "":
		return BasisBooked, nil
	case BasisBooked, BasisSettled:
		return basis, nil
	default:
		return "", &domain.FieldError{Field: "basis", Message: "must be booked or settled", Err: domain.ErrValidation}
	}
}

// BalancesAt returns the balance of every asset and liability account, in the account
// currency, ordered by account name then id.
func (s *Service) BalancesAt(ctx context.Context, booksID int64, date time.Time, basis Basis) ([]Balance, error) {
	basis, err := normalizeBasis(basis)
	if err != nil {
		return nil, err
	}

	totals, err := s.repo.BalancesAt(ctx, booksID, date, basis)
	if err != nil {
		return nil, err
	}

	out := make([]Balance, len(totals))
	for i, t := range totals {
		amount, err := s.AmountOf(ctx, t.Total, t.Instrument)
		if err != nil {
			return nil, err
		}

		out[i] = Balance{AccountID: t.AccountID, Date: date, Basis: basis, Amount: amount}
	}

	return out, nil
}

// CategoryTotal returns the weights of the postings of a category subtree booked in
// [from, to), in the book's base currency (P7 amendment A54).
func (s *Service) CategoryTotal(ctx context.Context, booksID int64, categoryID uuid.UUID, from, to time.Time) (money.Money, error) {
	settings, err := s.repo.Settings(ctx, booksID)
	if err != nil {
		return money.Money{}, err
	}

	if _, err := s.repo.Account(ctx, booksID, categoryID); err != nil {
		return money.Money{}, err
	}

	total, err := s.repo.CategoryTotal(ctx, booksID, categoryID, from, to)
	if err != nil {
		return money.Money{}, err
	}

	return money.New(total, settings.BaseCurrency)
}

// CategoryMonth is the total of a category's own postings in one month, in minor units of the
// base currency.
type CategoryMonth struct {
	CategoryID uuid.UUID
	Month      time.Time
	Total      int64
}

// OwnCategoryMonthlyTotals returns the own postings of every category of class by month in
// [from, to), in the base currency (budget plan amendment A129).
func (s *Service) OwnCategoryMonthlyTotals(ctx context.Context, booksID int64, class string, from, to time.Time) ([]CategoryMonth, money.Currency, error) {
	settings, err := s.repo.Settings(ctx, booksID)
	if err != nil {
		return nil, "", err
	}

	rows, err := s.repo.OwnCategoryMonthlyTotals(ctx, booksID, class, from, to)

	return rows, settings.BaseCurrency, err
}

// CategoryMonthlyTotals is CategoryTotal for each month in [from, to), keyed by its first day.
func (s *Service) CategoryMonthlyTotals(ctx context.Context, booksID int64, categoryID uuid.UUID, from, to time.Time) (map[time.Time]money.Money, error) {
	settings, err := s.repo.Settings(ctx, booksID)
	if err != nil {
		return nil, err
	}

	if _, err := s.repo.Account(ctx, booksID, categoryID); err != nil {
		return nil, err
	}

	totals, err := s.repo.CategoryMonthlyTotals(ctx, booksID, categoryID, from, to)
	if err != nil {
		return nil, err
	}

	out := make(map[time.Time]money.Money, len(totals))
	for m, total := range totals {
		if out[m], err = money.New(total, settings.BaseCurrency); err != nil {
			return nil, err
		}
	}

	return out, nil
}

// ValuedBalance is BalanceAt valued in currency in with stored prices (P8 amendment
// A65); a parent whose sub-accounts hold several instruments sums their values.
func (s *Service) ValuedBalance(ctx context.Context, booksID int64, accountID uuid.UUID, date time.Time, basis Basis, in money.Currency) (Balance, Conversion, error) {
	if basis == "" {
		basis = BasisBooked
	}

	if _, err := money.ParseCurrency(string(in)); err != nil {
		return Balance{}, Conversion{}, fieldErr("value_in", "must be a supported currency", domain.ErrValidation)
	}

	if _, err := s.repo.Account(ctx, booksID, accountID); err != nil {
		return Balance{}, Conversion{}, err
	}

	totals, err := s.repo.TreeBalancesByInstrument(ctx, booksID, accountID, date, basis)
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
		if !amount.IsZero() {
			out.Parts = append(out.Parts, ValuedPart{Instrument: code, Quantity: amount, Value: c.Value})
		}
	}

	b := Balance{AccountID: accountID, Date: date, Basis: basis, Amount: out.Value}
	if len(totals) == 1 {
		b.Amount = amount
	}

	return b, out, nil
}

// ExternalFlows is the money that entered (positive) or left (negative) the accounts and their
// sub-accounts, taken as one tree, between from and to, one item per transaction (investments
// design 4.3).
func (s *Service) ExternalFlows(ctx context.Context, booksID int64, accountIDs []uuid.UUID, from, to time.Time) ([]ExternalFlow, error) {
	if err := s.ownAccounts(ctx, booksID, accountIDs); err != nil {
		return nil, err
	}

	return s.repo.TreeExternalFlows(ctx, booksID, accountIDs, from, to)
}

// FirstPosting is the booked date of the earliest posting of the accounts and their
// sub-accounts; false when they have none.
func (s *Service) FirstPosting(ctx context.Context, booksID int64, accountIDs []uuid.UUID) (time.Time, bool, error) {
	if err := s.ownAccounts(ctx, booksID, accountIDs); err != nil {
		return time.Time{}, false, err
	}

	return s.repo.TreeFirstPosting(ctx, booksID, accountIDs)
}

// RecordedItem is an amount of a tree on a date: a flow or a credit is in the instrument of the
// tree accounts, an income or an expense in the balancing currency of its transaction. Label is
// the account name of an income or an expense; Postings is the number of tree postings of a
// credit.
type RecordedItem struct {
	Date     time.Time
	Value    money.Money
	Label    string
	Postings int
}

// RecordedYield is what the ledger records of a tree over a range (return comparison amendment
// A208 R19): Flows are the changes of the balance of the tree that are not yield, Credits the yield
// credited to it, Income and Expense the other income and expense postings of those transactions.
type RecordedYield struct {
	Flows, Credits, Income, Expense []RecordedItem
}

// RecordedYield reads the recorded yield of the accounts and their sub-accounts in [from, to].
func (s *Service) RecordedYield(ctx context.Context, booksID int64, accountIDs []uuid.UUID, from, to time.Time) (RecordedYield, error) {
	if err := s.ownAccounts(ctx, booksID, accountIDs); err != nil {
		return RecordedYield{}, err
	}

	return s.repo.TreeRecordedYield(ctx, booksID, accountIDs, from, to)
}

func (s *Service) ownAccounts(ctx context.Context, booksID int64, accountIDs []uuid.UUID) error {
	for _, id := range accountIDs {
		if _, err := s.repo.Account(ctx, booksID, id); err != nil {
			return err
		}
	}

	return nil
}

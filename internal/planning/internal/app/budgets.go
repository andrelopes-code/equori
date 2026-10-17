package app

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

// ErrBudgetExists refuses a second budget for a category (P7 amendment A54).
var ErrBudgetExists = errors.New("the category already has a budget")

// category returns the category account of the user and checks the base currency: budgets
// stay in it (P7 amendment A47, kept by P8 amendment A72).
func (s *Service) category(ctx context.Context, userID int64, id uuid.UUID) (Account, money.Currency, error) {
	base, err := s.ledger.BaseCurrency(ctx, userID)
	if err != nil {
		return Account{}, "", err
	}
	facts, err := s.ledger.AccountFacts(ctx, userID)
	if err != nil {
		return Account{}, "", err
	}
	for _, a := range facts {
		if a.ID != id {
			continue
		}
		if a.Class != "expense" && a.Class != "income" {
			break
		}
		if a.Instrument != base {
			return Account{}, "", &CurrencyError{Field: "category_id"}
		}
		return a, base, nil
	}
	return Account{}, "", &domain.FieldError{Field: "category_id", Message: "must be an income or expense category of the user", Err: domain.ErrValidation}
}

func checkBudgetAmount(m money.Money, currency money.Currency) error {
	if m.Currency() != currency {
		return &domain.FieldError{Field: "amount.currency", Message: "must be the base currency " + string(currency), Err: domain.ErrValidation}
	}
	if m.IsNegative() {
		return &domain.FieldError{Field: "amount", Message: "must not be negative", Err: domain.ErrValidation}
	}
	return nil
}

func (s *Service) CreateBudget(ctx context.Context, userID int64, categoryID uuid.UUID, amount money.Money, from time.Time, rollover bool) (domain.Budget, error) {
	_, base, err := s.category(ctx, userID, categoryID)
	if err != nil {
		return domain.Budget{}, err
	}
	if err := checkBudgetAmount(amount, base); err != nil {
		return domain.Budget{}, err
	}
	b := domain.Budget{CategoryID: categoryID, Rollover: rollover, Currency: base,
		Amounts: []domain.BudgetAmount{{EffectiveFrom: domain.MonthOf(from), Amount: amount.Amount()}}}
	var created domain.Budget
	err = s.repo.InTx(ctx, func(repo Repository) error {
		var err error
		created, err = repo.InsertBudget(ctx, userID, b)
		return err
	})
	return created, err
}

// AddBudgetAmount sets the amount from a month after the latest one on (T09).
func (s *Service) AddBudgetAmount(ctx context.Context, userID int64, id uuid.UUID, from time.Time, amount money.Money) (domain.Budget, error) {
	var out domain.Budget
	err := s.repo.InTx(ctx, func(repo Repository) error {
		b, err := repo.LockBudget(ctx, userID, id)
		if err != nil {
			return err
		}
		from = domain.MonthOf(from)
		if !from.After(b.Amounts[len(b.Amounts)-1].EffectiveFrom) {
			return &domain.FieldError{Field: "effective_from", Message: "must be after the latest amount", Err: domain.ErrValidation}
		}
		if err := checkBudgetAmount(amount, b.Currency); err != nil {
			return err
		}
		if err := repo.InsertBudgetAmount(ctx, userID, id, domain.BudgetAmount{EffectiveFrom: from, Amount: amount.Amount()}); err != nil {
			return err
		}
		out, err = repo.Budget(ctx, userID, id)
		return err
	})
	return out, err
}

func (s *Service) Budget(ctx context.Context, userID int64, id uuid.UUID) (domain.Budget, error) {
	return s.repo.Budget(ctx, userID, id)
}

func (s *Service) ListBudgets(ctx context.Context, userID int64, p page.Request[IDKey]) ([]domain.Budget, *IDKey, error) {
	return s.repo.ListBudgets(ctx, userID, p)
}

// BudgetProgress reports the month of a budget; spending of an income category is positive (A54).
func (s *Service) BudgetProgress(ctx context.Context, userID int64, id uuid.UUID, month time.Time) (domain.Progress, money.Currency, error) {
	b, err := s.repo.Budget(ctx, userID, id)
	if err != nil {
		return domain.Progress{}, "", err
	}
	category, _, err := s.category(ctx, userID, b.CategoryID)
	if err != nil {
		return domain.Progress{}, "", err
	}
	month = domain.MonthOf(month)
	if month.After(s.horizon()) {
		return domain.Progress{}, "", &domain.FieldError{Field: "month", Message: "must be at most today + 12 months", Err: domain.ErrValidation}
	}
	sign := int64(1)
	if category.Class == "income" {
		sign = -1
	}
	// One ledger query per request: the months of a rollover budget at once, or the month alone.
	var totals map[time.Time]int64
	if b.Rollover && len(b.Amounts) > 0 && !b.Amounts[0].EffectiveFrom.After(month) {
		if totals, err = s.ledger.CategoryMonthlyTotals(ctx, userID, b.CategoryID, b.Amounts[0].EffectiveFrom, month.AddDate(0, 1, 0)); err != nil {
			return domain.Progress{}, "", err
		}
	}
	spent := func(m time.Time) (int64, error) {
		if totals != nil {
			return sign * totals[m], nil
		}
		if !m.Equal(month) {
			return 0, nil
		}
		total, err := s.ledger.CategoryTotal(ctx, userID, b.CategoryID, m, m.AddDate(0, 1, 0))
		return sign * total, err
	}
	p, ok, err := b.Progress(month, spent)
	if err != nil {
		return domain.Progress{}, "", err
	}
	if !ok {
		return domain.Progress{}, "", &domain.FieldError{Field: "month", Message: "precedes the first amount of the budget", Err: domain.ErrValidation}
	}
	return p, b.Currency, nil
}

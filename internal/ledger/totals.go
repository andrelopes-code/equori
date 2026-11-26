// Package ledger records accounts, transactions and balances (docs/domain, chapters 5 and 7).
// It is the only entry point to the module for the rest of the application.
package ledger

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Commitment is the sum of installments billed on the statement of month while it is open
// (P2; P7 amendment A57).
func (m *Module) Commitment(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	month time.Time,
) (money.Money, error) {
	return m.svc.Commitment(ctx, booksID, accountID, domain.MonthOf(month))
}

// PriorInstallments returns the installments billed on the statement of month of purchases
// booked before month, one per charge (budget plan amendment A129).
func (m *Module) PriorInstallments(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	month time.Time,
) ([]PriorInstallment, error) {
	return m.svc.PriorInstallments(ctx, booksID, accountID, domain.MonthOf(month))
}

// OwnCategoryMonthlyTotals returns the own postings of every category of class (income or
// expense) by month in [from, to), in the base currency.
func (m *Module) OwnCategoryMonthlyTotals(
	ctx context.Context,
	booksID int64,
	class string,
	from, to time.Time,
) ([]CategoryMonth, error) {
	rows, base, err := m.svc.OwnCategoryMonthlyTotals(ctx, booksID, class, from, to)
	if err != nil {
		return nil, err
	}

	out := make([]CategoryMonth, len(rows))
	for i, r := range rows {
		total, err := money.New(r.Total, base)
		if err != nil {
			return nil, err
		}

		out[i] = CategoryMonth{CategoryID: r.CategoryID, Month: r.Month, Total: total}
	}

	return out, nil
}

// OwnCategoryPostings returns the non-voided own postings of the categories of class booked in
// [from, to), the latest first, in the base currency.
func (m *Module) OwnCategoryPostings(
	ctx context.Context,
	booksID int64,
	class string,
	from, to time.Time,
) ([]CategoryPosting, error) {
	rows, base, err := m.svc.OwnCategoryPostings(ctx, booksID, class, from, to)
	if err != nil {
		return nil, err
	}

	out := make([]CategoryPosting, len(rows))
	for i, r := range rows {
		amount, err := money.New(r.Weight, base)
		if err != nil {
			return nil, err
		}

		out[i] = CategoryPosting{
			TransactionID: r.TransactionID,
			CategoryID:    r.CategoryID,
			BookedOn:      r.BookedOn,
			Amount:        amount,
			Description:   r.Description,
			Payee:         r.Payee,
		}
	}

	return out, nil
}

// CategoryMonthlyTotals is CategoryTotal for each month in [from, to), keyed by its first day.
func (m *Module) CategoryMonthlyTotals(
	ctx context.Context,
	booksID int64,
	categoryID uuid.UUID,
	from, to time.Time,
) (map[time.Time]money.Money, error) {
	return m.svc.CategoryMonthlyTotals(ctx, booksID, categoryID, from, to)
}

// CategoryTotal sums the postings of a category subtree booked in [from, to), in the base
// currency (P7 amendment A54).
func (m *Module) CategoryTotal(
	ctx context.Context,
	booksID int64,
	categoryID uuid.UUID,
	from, to time.Time,
) (money.Money, error) {
	return m.svc.CategoryTotal(ctx, booksID, categoryID, from, to)
}

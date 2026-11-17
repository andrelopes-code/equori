package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// categorized reports an entry between a category and an account of another currency: an income
// or an expense with two amounts, which is not an exchange between two balance accounts.
func (p recordPlan) categorized() bool {
	return p.exchange && (!p.from.IsBalance() || !p.dests[0].account.IsBalance())
}

// recordPostings builds the postings of an entry that no dedicated use case records. A posting
// on an account in a currency other than the base carries its value in the base currency as
// the weight (DM1).
func recordPostings(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordTransactionIn,
	p recordPlan,
) ([]domain.Posting, error) {
	if p.categorized() {
		return categorizedPostings(p), nil
	}

	total := money.Money{}
	postings := []domain.Posting{{AccountID: p.from.ID, Amount: p.amount.Neg()}}

	for i, d := range p.dests {
		value, err := svc.BaseValue(ctx, booksID, d.amount, in.Date.Time)
		if err != nil {
			return nil, err
		}

		posting := domain.Posting{AccountID: d.account.ID, Amount: d.amount}
		if value.Currency() != d.amount.Currency() {
			posting.Weight = value
		}

		postings = append(postings, posting)

		if i == 0 {
			total = value
		} else if total, err = total.Add(value); err != nil {
			return nil, err
		}
	}

	// The origin leaves what the destinations receive, so the weights add up to zero.
	if total.Currency() != p.amount.Currency() {
		postings[0].Weight = total.Neg()
	}

	return postings, nil
}

// categorizedPostings values the side in another currency by the side in the base currency:
// amount is in the currency of the origin and toAmount in the currency of the destination, and
// the category holds the base currency.
func categorizedPostings(p recordPlan) []domain.Posting {
	from := domain.Posting{AccountID: p.from.ID, Amount: p.amount.Neg()}
	to := domain.Posting{AccountID: p.dests[0].account.ID, Amount: p.toAmount}

	if p.from.IsBalance() {
		from.Weight = p.toAmount.Neg()
	} else {
		to.Weight = p.amount
	}

	return []domain.Posting{from, to}
}

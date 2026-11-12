package domain

import (
	"fmt"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Allocation is the part of Original that a reimbursement repays. HeldByOthers is what the
// non-voided reimbursements of other transactions already repay (A117).
type Allocation struct {
	Original     Transaction
	Amount       int64
	HeldByOthers int64
}

// Reimburse returns the next version of t, an inflow, whose reimbursement of the expenses is
// exactly allocations (A117). Its category postings become, for each allocation, negative
// postings on the expense categories of that expense, allocated by their amounts; what is not
// allocated stays on the uncategorized income account. Its reimbursement_of links are replaced
// by one link per allocation. An empty list is valid only for an inflow that has such links.
// accounts must hold the accounts of t and of every original.
func (t Transaction) Reimburse(
	expectedVersion int,
	allocations []Allocation,
	uncategorized Account,
	accounts map[uuid.UUID]Account,
) (Transaction, error) {
	total, instrument, err := t.reimbursableTotal(expectedVersion, allocations, accounts)
	if err != nil {
		return Transaction{}, err
	}

	isReimbursement := func(l Link) bool { return l.Type == LinkReimbursementOf }
	if len(allocations) == 0 && !slices.ContainsFunc(t.Links, isReimbursement) {
		return Transaction{}, invalid("allocations", "must not be empty")
	}

	plan := reimbursementPlan{links: slices.DeleteFunc(slices.Clone(t.Links), isReimbursement)}
	if err := plan.allocate(t, allocations, instrument, accounts); err != nil {
		return Transaction{}, err
	}

	if plan.allocated > -total {
		return Transaction{}, invalid(
			"allocations",
			fmt.Sprintf("allocations total %d, above the inflow %d", plan.allocated, -total),
		)
	}

	if rest := -total - plan.allocated; rest > 0 {
		m, err := money.New(-rest, instrument)
		if err != nil {
			return Transaction{}, err
		}

		plan.parts = append(plan.parts, CategoryPart{AccountID: uncategorized.ID, Amount: m})
	}

	next, err := t.Categorize(
		Categorization{ExpectedVersion: expectedVersion, Parts: plan.parts},
		accounts,
	)
	if err != nil {
		return Transaction{}, err
	}

	next.Links = plan.links

	return next, nil
}

// reimbursementPlan collects what the allocations of a reimbursement produce.
type reimbursementPlan struct {
	parts     []CategoryPart
	links     []Link
	allocated int64
}

func (t Transaction) reimbursableTotal(
	expectedVersion int,
	allocations []Allocation,
	accounts map[uuid.UUID]Account,
) (int64, money.Currency, error) {
	if t.VoidedAt != nil ||
		slices.ContainsFunc(
			allocations,
			func(a Allocation) bool { return a.Original.VoidedAt != nil },
		) {
		return 0, "", ErrVoided
	}

	if expectedVersion != t.Version {
		return 0, "", ErrVersionConflict
	}

	var total int64

	var instrument money.Currency
	for _, p := range t.Postings {
		if accounts[p.AccountID].IsCategory() {
			total += p.Amount.Amount()
			instrument = p.Amount.Currency()
		}
	}

	if instrument == "" || total >= 0 {
		return 0, "", ErrNotCategorizable
	}

	return total, instrument, nil
}

func (plan *reimbursementPlan) allocate(
	t Transaction,
	allocations []Allocation,
	instrument money.Currency,
	accounts map[uuid.UUID]Account,
) error {
	seen := make(map[uuid.UUID]bool, len(allocations))
	for i, a := range allocations {
		spent, shares, expense := expenseShares(a, accounts)
		if err := checkAllocation(i, a, t, seen, instrument, spent, expense); err != nil {
			return err
		}

		seen[a.Original.ID] = true
		for j, share := range Allocate(a.Amount, shares) {
			if share == 0 {
				continue
			}

			m, err := money.New(-share, instrument)
			if err != nil {
				return err
			}

			plan.parts = append(plan.parts, CategoryPart{AccountID: spent[j].AccountID, Amount: m})
		}

		plan.allocated += a.Amount
		plan.links = append(
			plan.links,
			Link{Type: LinkReimbursementOf, Target: a.Original.ID, Amount: a.Amount},
		)
	}

	return nil
}

func expenseShares(
	a Allocation,
	accounts map[uuid.UUID]Account,
) (spent []Posting, shares []int64, expense int64) {
	for _, p := range a.Original.Postings {
		if accounts[p.AccountID].Class == ClassExpense && p.Amount.Amount() > 0 {
			spent = append(spent, p)
			shares = append(shares, p.Amount.Amount())
			expense += p.Amount.Amount()
		}
	}

	return spent, shares, expense
}

func checkAllocation(
	i int,
	a Allocation,
	t Transaction,
	seen map[uuid.UUID]bool,
	instrument money.Currency,
	spent []Posting,
	expense int64,
) error {
	field := func(name string) string { return fmt.Sprintf("allocations[%d].%s", i, name) }

	switch {
	case a.Amount <= 0:
		return invalid(field("amount"), "must be positive")
	case a.Original.ID == t.ID:
		return invalid(field("original_id"), "must be another transaction")
	case seen[a.Original.ID]:
		return invalid(field("original_id"), "is listed twice")
	case len(spent) == 0:
		return invalid(field("original_id"), "has no expense category to reimburse")
	case spent[0].Amount.Currency() != instrument:
		return invalid(field("original_id"), "must be in the currency "+string(instrument))
	case a.HeldByOthers+a.Amount > expense:
		return invalid(
			field("original_id"),
			fmt.Sprintf(
				"reimbursements would total %d, above the expense %d",
				a.HeldByOthers+a.Amount,
				expense,
			),
		)
	}

	return nil
}

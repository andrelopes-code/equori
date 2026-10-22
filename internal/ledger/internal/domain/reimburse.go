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
func (t Transaction) Reimburse(expectedVersion int, allocations []Allocation, uncategorized Account, accounts map[uuid.UUID]Account) (Transaction, error) {
	if t.VoidedAt != nil || slices.ContainsFunc(allocations, func(a Allocation) bool { return a.Original.VoidedAt != nil }) {
		return Transaction{}, ErrVoided
	}
	if expectedVersion != t.Version {
		return Transaction{}, ErrVersionConflict
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
		return Transaction{}, ErrNotCategorizable
	}
	isReimbursement := func(l Link) bool { return l.Type == LinkReimbursementOf }
	if len(allocations) == 0 && !slices.ContainsFunc(t.Links, isReimbursement) {
		return Transaction{}, invalid("allocations", "must not be empty")
	}
	links := slices.DeleteFunc(slices.Clone(t.Links), isReimbursement)
	var parts []CategoryPart
	var allocated int64
	seen := make(map[uuid.UUID]bool, len(allocations))
	for i, a := range allocations {
		field := func(name string) string { return fmt.Sprintf("allocations[%d].%s", i, name) }
		var shares []int64
		var spent []Posting
		var expense int64
		for _, p := range a.Original.Postings {
			if accounts[p.AccountID].Class == ClassExpense && p.Amount.Amount() > 0 {
				spent = append(spent, p)
				shares = append(shares, p.Amount.Amount())
				expense += p.Amount.Amount()
			}
		}
		switch {
		case a.Amount <= 0:
			return Transaction{}, invalid(field("amount"), "must be positive")
		case a.Original.ID == t.ID:
			return Transaction{}, invalid(field("original_id"), "must be another transaction")
		case seen[a.Original.ID]:
			return Transaction{}, invalid(field("original_id"), "is listed twice")
		case len(spent) == 0:
			return Transaction{}, invalid(field("original_id"), "has no expense category to reimburse")
		case spent[0].Amount.Currency() != instrument:
			return Transaction{}, invalid(field("original_id"), "must be in the currency "+string(instrument))
		case a.HeldByOthers+a.Amount > expense:
			return Transaction{}, invalid(field("original_id"), fmt.Sprintf("reimbursements would total %d, above the expense %d", a.HeldByOthers+a.Amount, expense))
		}
		seen[a.Original.ID] = true
		for j, share := range Allocate(a.Amount, shares) {
			if share == 0 {
				continue
			}
			m, err := money.New(-share, instrument)
			if err != nil {
				return Transaction{}, err
			}
			parts = append(parts, CategoryPart{AccountID: spent[j].AccountID, Amount: m})
		}
		allocated += a.Amount
		links = append(links, Link{Type: LinkReimbursementOf, Target: a.Original.ID, Amount: a.Amount})
	}
	if allocated > -total {
		return Transaction{}, invalid("allocations", fmt.Sprintf("allocations total %d, above the inflow %d", allocated, -total))
	}
	if rest := -total - allocated; rest > 0 {
		m, err := money.New(-rest, instrument)
		if err != nil {
			return Transaction{}, err
		}
		parts = append(parts, CategoryPart{AccountID: uncategorized.ID, Amount: m})
	}
	next, err := t.Categorize(Categorization{ExpectedVersion: expectedVersion, Parts: parts}, accounts)
	if err != nil {
		return Transaction{}, err
	}
	next.Links = links
	return next, nil
}

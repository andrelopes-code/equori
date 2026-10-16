package domain

import (
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// HistoryKey selects the payee history of one category class (P5 amendment A23).
type HistoryKey struct {
	PayeeID uuid.UUID
	Class   string
}

// Catalog is what a decision reads. Rules are enabled and sorted by priority; aliases are
// sorted by SortAliases.
type Catalog struct {
	Rules      []Rule
	Aliases    []Alias
	Categories map[uuid.UUID]Category
	// Accounts are the asset and liability accounts that transfers may target.
	Accounts map[uuid.UUID]Category
	History  map[HistoryKey]uuid.UUID
}

// Decision is the outcome of F5 for one subject. Method is empty when no category was
// decided; PayeeID is zero when the payee does not change.
type Decision struct {
	PayeeID uuid.UUID
	AddTags []string
	Parts   []Allocation
	// TransferTo replaces the category side with a posting on this account (P5b A31).
	TransferTo uuid.UUID
	Method     string
	RuleID     uuid.UUID
}

// Payee is the payee the subject has after the decision.
func (d Decision) Payee(s Subject) uuid.UUID {
	if d.PayeeID != uuid.Nil {
		return d.PayeeID
	}
	return s.PayeeID
}

// Decide applies aliases (A22), rules (A21), the mapped source category (P6 A41) and payee
// history (A23) to s, in that precedence (F5).
func Decide(s Subject, c Catalog) Decision {
	var d Decision
	if s.PayeeID == uuid.Nil {
		if p, ok := ResolvePayee(s.RawDescription, c.Aliases); ok {
			d.PayeeID, s.PayeeID = p, p
		}
	}
	subj := newSubject(s)
	total := s.Amount.Neg()
	categoryDecided, payeeDecided := false, false
	for _, r := range c.Rules {
		if !r.matches(subj) {
			continue
		}
		parts, transfer, ok := r.allocation(total, c, s)
		if !ok {
			continue
		}
		if (parts != nil || transfer != uuid.Nil) && !categoryDecided {
			d.Parts, d.TransferTo, d.Method, d.RuleID, categoryDecided = parts, transfer, MethodRule, r.ID, true
		}
		for _, a := range r.Actions {
			switch a.Type {
			case ActionSetPayee:
				if !payeeDecided {
					d.PayeeID, payeeDecided = a.PayeeID, true
				}
			case ActionAddTags:
				d.AddTags = append(d.AddTags, a.Tags...)
			}
		}
		if r.StopProcessing {
			break
		}
	}
	slices.Sort(d.AddTags)
	d.AddTags = slices.Compact(d.AddTags)
	if id := s.SourceCategory; !categoryDecided && id != uuid.Nil {
		if cat, ok := c.Categories[id]; ok && cat.usable(total.Currency(), s.Date) {
			d.Parts, d.Method, categoryDecided = []Allocation{{CategoryID: id, Amount: total}}, MethodSource, true
		}
	}
	if !categoryDecided {
		if id, ok := c.History[HistoryKey{PayeeID: d.Payee(s), Class: s.Class}]; ok && d.Payee(s) != uuid.Nil {
			if cat, ok := c.Categories[id]; ok && cat.usable(total.Currency(), s.Date) {
				d.Parts, d.Method = []Allocation{{CategoryID: id, Amount: total}}, MethodHistory
			}
		}
	}
	return d
}

// allocation returns the category postings or the transfer target of r's category action,
// neither without one, and false when the action cannot apply to s.
func (r Rule) allocation(total money.Money, c Catalog, s Subject) ([]Allocation, uuid.UUID, bool) {
	for _, a := range r.Actions {
		switch a.Type {
		case ActionSetCategory:
			parts, ok := Allocate(total, []Part{{CategoryID: a.CategoryID, Remainder: true}}, c.Categories, s.Date)
			return parts, uuid.Nil, ok
		case ActionSplit:
			parts, ok := Allocate(total, a.Parts, c.Categories, s.Date)
			return parts, uuid.Nil, ok
		case ActionTransfer, ActionMarkReimbursable:
			target, ok := c.Accounts[a.AccountID]
			if !ok || !target.usable(total.Currency(), s.Date) || slices.Contains(s.Accounts, a.AccountID) {
				return nil, uuid.Nil, false
			}
			return nil, a.AccountID, true
		}
	}
	return nil, uuid.Nil, true
}

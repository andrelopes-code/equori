package domain

import (
	"errors"
	"fmt"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// CategoryState classifies a transaction by its category postings (P5 amendment A17).
type CategoryState string

const (
	CategoryNone          CategoryState = "none"
	CategoryUncategorized CategoryState = "uncategorized"
	CategoryCategorized   CategoryState = "categorized"
)

const maxCategoryParts = 50

var ErrNotCategorizable = errors.New("transaction has no category postings")

// IsCategory reports whether postings on a are category postings.
func (a Account) IsCategory() bool { return a.Class == ClassIncome || a.Class == ClassExpense }

func (a Account) isUncategorized() bool {
	return a.SystemRole == RoleUncategorizedExpense || a.SystemRole == RoleUncategorizedIncome
}

func (t Transaction) CategoryState(accounts map[uuid.UUID]Account) CategoryState {
	state := CategoryNone
	for _, p := range t.Postings {
		a := accounts[p.AccountID]
		switch {
		case !a.IsCategory():
		case !a.isUncategorized():
			return CategoryCategorized
		default:
			state = CategoryUncategorized
		}
	}
	return state
}

// CategoryPart is one category posting of a categorization, signed like the posting.
type CategoryPart struct {
	AccountID uuid.UUID
	Amount    money.Money
}

// Categorization changes the category side of a transaction (P5 amendment A18).
type Categorization struct {
	ExpectedVersion int
	Parts           []CategoryPart // nil keeps the category postings
	PayeeID         *uuid.UUID     // nil keeps the payee
	AddTags         []string
}

// Categorize returns the next version of t. Balance-sheet postings keep their ids and
// status, so a reconciled posting does not block it; category postings are never reconciled.
func (t Transaction) Categorize(c Categorization, accounts map[uuid.UUID]Account) (Transaction, error) {
	if t.VoidedAt != nil {
		return Transaction{}, ErrVoided
	}
	if c.ExpectedVersion != t.Version {
		return Transaction{}, ErrVersionConflict
	}
	var kept, replaced []Posting
	for _, p := range t.Postings {
		if accounts[p.AccountID].IsCategory() {
			replaced = append(replaced, p)
		} else {
			kept = append(kept, p)
		}
	}
	if len(replaced) == 0 {
		return Transaction{}, ErrNotCategorizable
	}
	if c.Parts != nil {
		parts, err := categoryPostings(t, replaced, c.Parts, accounts)
		if err != nil {
			return Transaction{}, err
		}
		t.Postings = append(slices.Clip(kept), parts...)
	}
	if c.PayeeID != nil {
		t.PayeeID = *c.PayeeID
	}
	tags, err := normalizeTags(append(slices.Clip(t.Tags), c.AddTags...))
	if err != nil {
		return Transaction{}, err
	}
	t.Tags = tags
	t.Version++
	return t, nil
}

func categoryPostings(t Transaction, replaced []Posting, parts []CategoryPart, accounts map[uuid.UUID]Account) ([]Posting, error) {
	if len(parts) == 0 || len(parts) > maxCategoryParts {
		return nil, invalid("parts", fmt.Sprintf("must have 1 to %d parts", maxCategoryParts))
	}
	instrument := replaced[0].Amount.Currency()
	var total int64
	for _, p := range replaced {
		if p.Amount.Currency() != instrument || p.Weight != p.Amount {
			return nil, invalid("parts", "category postings in several currencies cannot be categorized")
		}
		total += p.Amount.Amount()
	}
	out := make([]Posting, len(parts))
	var sum int64
	for i, part := range parts {
		field := func(name string) string { return fmt.Sprintf("parts[%d].%s", i, name) }
		a, ok := accounts[part.AccountID]
		switch {
		case !ok || a.UserID != t.UserID:
			return nil, &FieldError{Field: field("account_id"), Message: "unknown account", Err: ErrUnknownAccount}
		case !a.IsCategory():
			return nil, invalid(field("account_id"), "must be an income or expense account")
		case !a.IsOpenOn(t.Date):
			return nil, &FieldError{Field: field("account_id"), Message: "account is not open on the transaction date", Err: ErrAccountClosed}
		case a.Instrument != instrument || part.Amount.Currency() != instrument:
			return nil, invalid(field("amount"), "must be in the currency "+string(instrument))
		case part.Amount.IsZero():
			return nil, invalid(field("amount"), "must not be zero")
		}
		sum += part.Amount.Amount()
		out[i] = Posting{AccountID: a.ID, Amount: part.Amount, Weight: part.Amount, Status: defaultPostStatus}
	}
	if sum != total {
		return nil, invalid("parts", fmt.Sprintf("must sum to %d", total))
	}
	return out, nil
}

// CategoriesChanged reports whether the category postings of prev and next differ as
// multisets of account and amount.
func CategoriesChanged(prev, next Transaction, accounts map[uuid.UUID]Account) bool {
	return !slices.Equal(categoryKeys(prev, accounts), categoryKeys(next, accounts))
}

func categoryKeys(t Transaction, accounts map[uuid.UUID]Account) []string {
	var keys []string
	for _, p := range t.Postings {
		if accounts[p.AccountID].IsCategory() {
			keys = append(keys, p.AccountID.String()+" "+p.Amount.String())
		}
	}
	slices.Sort(keys)
	return keys
}

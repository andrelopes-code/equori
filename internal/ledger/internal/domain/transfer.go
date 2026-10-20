package domain

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Transfer returns the next version of t with every category or transit posting (A88)
// replaced by one posting on the balance-sheet account a, for their sum (P5b amendment A28). The new posting
// confirms link when it is set. A card credit becomes a payment and is billed again, so it
// must not be reconciled. accounts must hold the accounts of t and a.
func (t Transaction) Transfer(expectedVersion int, a Account, link uuid.UUID, accounts map[uuid.UUID]Account) (Transaction, error) {
	if t.VoidedAt != nil {
		return Transaction{}, ErrVoided
	}
	if expectedVersion != t.Version {
		return Transaction{}, ErrVersionConflict
	}
	var kept []Posting
	var instrument money.Currency
	var total int64
	for _, p := range t.Postings {
		if !accounts[p.AccountID].IsReplaceable() {
			kept = append(kept, p)
			continue
		}
		if p.Weight != p.Amount || (instrument != "" && p.Amount.Currency() != instrument) {
			return Transaction{}, invalid("account_id", "category postings in several currencies cannot be transferred")
		}
		instrument = p.Amount.Currency()
		total += p.Amount.Amount()
	}
	if instrument == "" {
		return Transaction{}, ErrNotCategorizable
	}
	switch {
	case a.ID == uuid.Nil || a.UserID != t.UserID:
		return Transaction{}, &FieldError{Field: "account_id", Message: "unknown account", Err: ErrUnknownAccount}
	case !a.IsBalance():
		return Transaction{}, invalid("account_id", "must be an asset or liability account")
	case !a.IsOpenOn(t.Date):
		return Transaction{}, &FieldError{Field: "account_id", Message: "account is not open on the transaction date", Err: ErrAccountClosed}
	case a.Instrument != instrument:
		return Transaction{}, invalid("account_id", "must be in the currency "+string(instrument))
	}
	amount, err := money.New(total, instrument)
	if err != nil || amount.IsZero() {
		return Transaction{}, invalid("account_id", "the category postings sum to zero")
	}
	for i, p := range kept {
		if p.AccountID == a.ID {
			return Transaction{}, invalid("account_id", "must differ from the accounts of the transaction")
		}
		if p.CardRole == RoleCredit {
			if p.Status == StatusReconciled {
				return Transaction{}, ErrReconciled
			}
			// Without a category the credit is a payment, billed again (P2 amendment A5).
			kept[i].ID, kept[i].CardRole, kept[i].Statement, kept[i].StatementID = uuid.Nil, "", nil, uuid.Nil
		}
	}
	next := t
	next.Postings = append(kept, Posting{AccountID: a.ID, Amount: amount, ExternalRecordID: link})
	next.Version++
	return NewTransaction(next, accounts)
}

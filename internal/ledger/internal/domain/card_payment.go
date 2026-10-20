package domain

import (
	"errors"

	"github.com/google/uuid"
)

// ErrNotRetypable: the transaction no longer holds only its imported card line and an
// uncategorized side, so a later line type cannot rewrite it.
var ErrNotRetypable = errors.New("the transaction was changed after its import")

// AsCardPayment returns the next version of t, a card credit booked against an
// uncategorized account, as a card payment against the transit account (A88). The card
// posting keeps its statement, status and external record.
func (t Transaction) AsCardPayment(transit Account, accounts map[uuid.UUID]Account) (Transaction, error) {
	if t.VoidedAt != nil {
		return Transaction{}, ErrVoided
	}
	var card *Posting
	next := t
	next.Postings = nil
	for _, p := range t.Postings {
		a := accounts[p.AccountID]
		switch {
		case p.CardRole == RoleCredit && card == nil:
			if p.Status == StatusReconciled {
				return Transaction{}, ErrReconciled
			}
			p.ID, p.CardRole, p.StatementID = uuid.Nil, RolePayment, uuid.Nil
			next.Postings = append(next.Postings, p)
			card = &next.Postings[len(next.Postings)-1]
		case a.SystemRole == RoleUncategorizedIncome || a.SystemRole == RoleUncategorizedExpense:
		default:
			return Transaction{}, ErrNotRetypable
		}
	}
	if card == nil {
		return Transaction{}, ErrNotRetypable
	}
	next.Postings = append(next.Postings, Posting{AccountID: transit.ID, Amount: card.Amount.Neg()})
	next.Version++
	return NewTransaction(next, accounts)
}

package domain

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ToLine returns t corrected to a statement line it is matched to (A101): the posting on
// accountID takes amount and the transaction takes date; the other postings scale to the new
// amount, the last one taking the remainder, so the transaction stays balanced. changed is
// false when amount and date already hold.
func (t Transaction) ToLine(accountID uuid.UUID, amount int64, date time.Time) (next Transaction, changed bool, err error) {
	at := -1
	for i, p := range t.Postings {
		if p.AccountID == accountID {
			at = i
			break
		}
	}
	if at == -1 {
		return Transaction{}, false, invalid("account_id", "has no posting in the transaction")
	}
	old := t.Postings[at].Amount
	if old.Amount() == amount && t.Date.Equal(date) {
		return t, false, nil
	}
	if old.IsZero() {
		return Transaction{}, false, invalid("amount", "a zero posting cannot scale")
	}
	next = t
	next.Date = date
	next.Postings = make([]Posting, len(t.Postings))
	last := len(t.Postings) - 1
	if last == at {
		last--
	}
	var rest int64
	for i, p := range t.Postings {
		// Correct moves the record links of the current postings (keepRecordLinks).
		p.ID, p.Weight, p.StatementID, p.ExternalRecordID = uuid.Nil, money.Money{}, uuid.Nil, uuid.Nil
		if p.Amount.Currency() != old.Currency() {
			return Transaction{}, false, invalid("postings", "a transaction in several currencies cannot take a line's amount")
		}
		scaled := amount
		if i != at {
			scaled = p.Amount.Amount() * amount / old.Amount()
			if i == last {
				scaled = -amount - rest
			}
			rest += scaled
		}
		if p.Amount, err = money.New(scaled, old.Currency()); err != nil {
			return Transaction{}, false, err
		}
		next.Postings[i] = p
	}
	return next, true, nil
}

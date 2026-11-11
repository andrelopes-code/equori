package domain

import (
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// MoveReconciledDate returns t on date, its amount unchanged, for a line whose date changed
// after its card posting was reconciled (P12 A147 rule 3). The posting on accountID and every
// reconciled posting must be card postings, else ErrReconciled; the postings keep their status.
// changed is false when date already holds.
func (t Transaction) MoveReconciledDate(accountID uuid.UUID, date time.Time, accounts map[uuid.UUID]Account) (next Transaction, changed bool, err error) {
	if t.VoidedAt != nil {
		return Transaction{}, false, ErrVoided
	}

	at := slices.IndexFunc(t.Postings, func(p Posting) bool { return p.AccountID == accountID })
	if at == -1 {
		return Transaction{}, false, invalid("account_id", "has no posting in the transaction")
	}

	if t.Postings[at].CardRole == "" {
		return Transaction{}, false, ErrReconciled
	}

	if slices.ContainsFunc(t.Postings, func(p Posting) bool { return p.Status == StatusReconciled && p.CardRole == "" }) {
		return Transaction{}, false, ErrReconciled
	}

	next, changed, err = t.ToLine(accountID, t.Postings[at].Amount.Amount(), date)
	if err != nil || !changed {
		return t, false, err
	}

	next, err = t.correctTo(next, accounts)

	return next, err == nil, err
}

// KeepsReconciledStatements reports whether each reconciled posting of t has, at the same
// ordinal on its account in next, a posting on the same statement.
func (t Transaction) KeepsReconciledStatements(next Transaction) bool {
	for k, p := range t.Postings {
		if p.Status != StatusReconciled {
			continue
		}

		i := nthOnAccount(next.Postings, p.AccountID, ordinalOnAccount(t.Postings, k))
		if i == -1 || p.Statement == nil || next.Postings[i].Statement == nil || *next.Postings[i].Statement != *p.Statement {
			return false
		}
	}

	return true
}

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
		if !date.Equal(t.Date) && (p.StatementBasis == BasisDate || p.StatementBasis == "") {
			// A136: a statement the date chose follows the line's date.
			p.Statement = nil
		}

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

// LinePart is one line of a group (A169): the amount of its posting and whether the institution
// has settled it.
type LinePart struct {
	Amount  int64
	Pending bool
}

// SplitToLines returns t with the first posting on accountID replaced by one posting per part, in
// order, and the date set to date (A169). The parts sum to the replaced amount, so the other
// postings keep theirs. A statement the date chose is derived again (A136).
func (t Transaction) SplitToLines(accountID uuid.UUID, date time.Time, parts []LinePart) (Transaction, error) {
	at := slices.IndexFunc(t.Postings, func(p Posting) bool { return p.AccountID == accountID })
	if at < 0 {
		return Transaction{}, invalid("account_id", "has no posting in the transaction")
	}

	if len(parts) < 2 {
		return Transaction{}, invalid("parts", "a group has at least two lines")
	}

	old := t.Postings[at].Amount

	var sum int64

	for _, part := range parts {
		if part.Amount == 0 || (part.Amount < 0) != (old.Amount() < 0) {
			return Transaction{}, invalid("parts", "each must be nonzero and carry the sign of the posting")
		}

		sum += part.Amount
	}

	if sum != old.Amount() {
		return Transaction{}, invalid("parts", "must sum to the amount of the posting they replace")
	}

	next := t
	next.Date = date
	next.Postings = make([]Posting, 0, len(t.Postings)+len(parts)-1)

	for i, p := range t.Postings {
		p.ID, p.Weight, p.StatementID, p.ExternalRecordID = uuid.Nil, money.Money{}, uuid.Nil, uuid.Nil
		if p.StatementBasis == BasisDate || p.StatementBasis == "" {
			p.Statement = nil
		}

		if i != at {
			next.Postings = append(next.Postings, p)

			continue
		}

		for _, part := range parts {
			split := p
			split.Status = StatusCleared

			if part.Pending {
				split.Status = StatusPending
			}

			amount, err := money.New(part.Amount, old.Currency())
			if err != nil {
				return Transaction{}, err
			}

			split.Amount = amount
			next.Postings = append(next.Postings, split)
		}
	}

	return next, nil
}

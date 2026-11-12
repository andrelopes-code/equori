package domain

import (
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Transfer returns the next version of t with every category or transit posting (A88)
// replaced by one posting on the balance-sheet account a, for their sum (P5b amendment A28). The new posting
// confirms link when it is set. A card credit becomes a payment and is billed again, so it
// must not be reconciled. accounts must hold the accounts of t and a.
func (t Transaction) Transfer(
	expectedVersion int,
	a Account,
	link uuid.UUID,
	accounts map[uuid.UUID]Account,
) (Transaction, error) {
	if t.VoidedAt != nil {
		return Transaction{}, ErrVoided
	}

	if expectedVersion != t.Version {
		return Transaction{}, ErrVersionConflict
	}

	kept, total, instrument, err := replaceablePostings(t, accounts)
	if err != nil {
		return Transaction{}, err
	}

	if err := checkTransferAccount(a, t, instrument); err != nil {
		return Transaction{}, err
	}

	amount, err := money.New(total, instrument)
	if err != nil || amount.IsZero() {
		return Transaction{}, invalid("account_id", "the category postings sum to zero")
	}

	for i, p := range kept {
		if p.AccountID == a.ID {
			return Transaction{}, invalid(
				"account_id",
				"must differ from the accounts of the transaction",
			)
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

// replaceablePostings splits the postings into the ones a transfer keeps and the total of the ones it replaces.
func replaceablePostings(
	t Transaction,
	accounts map[uuid.UUID]Account,
) (kept []Posting, total int64, instrument money.Currency, err error) {
	for _, p := range t.Postings {
		if !accounts[p.AccountID].IsReplaceable() {
			kept = append(kept, p)
			continue
		}

		if p.Weight != p.Amount || (instrument != "" && p.Amount.Currency() != instrument) {
			return nil, 0, "", invalid(
				"account_id",
				"category postings in several currencies cannot be transferred",
			)
		}

		instrument = p.Amount.Currency()
		total += p.Amount.Amount()
	}

	if instrument == "" {
		return nil, 0, "", ErrNotCategorizable
	}

	return kept, total, instrument, nil
}

func checkTransferAccount(a Account, t Transaction, instrument money.Currency) error {
	switch {
	case a.ID == uuid.Nil || a.BooksID != t.BooksID:
		return &FieldError{Field: "account_id", Message: "unknown account", Err: ErrUnknownAccount}
	case !a.IsBalance():
		return invalid("account_id", "must be an asset or liability account")
	case !a.IsOpenOn(t.Date):
		return &FieldError{
			Field:   "account_id",
			Message: "account is not open on the transaction date",
			Err:     ErrAccountClosed,
		}
	case a.Instrument != instrument:
		return invalid("account_id", "must be in the currency "+string(instrument))
	}

	return nil
}

// Unpair returns the next version of t without the posting that link confirms and with the
// category and transit postings of before in its place (A220 rule 2). ErrVoided, then
// ErrVersionConflict when t is not at expectedVersion, ErrReconciled when that posting is
// reconciled, ErrValidation when no posting carries link or before holds a card credit.
func (t Transaction) Unpair(
	expectedVersion int,
	link uuid.UUID,
	before Transaction,
	accounts map[uuid.UUID]Account,
) (Transaction, error) {
	if t.VoidedAt != nil {
		return Transaction{}, ErrVoided
	}

	if expectedVersion != t.Version {
		return Transaction{}, ErrVersionConflict
	}

	at := slices.IndexFunc(
		t.Postings,
		func(p Posting) bool { return link != uuid.Nil && p.ExternalRecordID == link },
	)
	if at < 0 {
		return Transaction{}, invalid("record_id", "confirms no posting")
	}

	if t.Postings[at].Status == StatusReconciled {
		return Transaction{}, ErrReconciled
	}

	if slices.ContainsFunc(
		before.Postings,
		func(p Posting) bool { return p.CardRole == RoleCredit },
	) {
		return Transaction{}, invalid(
			"record_id",
			"a card credit paired as a payment does not return",
		)
	}

	postings := slices.Delete(slices.Clone(t.Postings), at, at+1)
	for _, p := range before.Postings {
		if accounts[p.AccountID].IsReplaceable() {
			p.ID, p.ExternalRecordID = uuid.Nil, uuid.Nil
			postings = append(postings, p)
		}
	}

	next := t
	next.Postings = postings
	next.Version++

	return NewTransaction(next, accounts)
}

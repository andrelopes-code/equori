package domain

import (
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	MaxPostings       = 500
	maxTextLength     = 500
	maxTagLength      = 60
	initialVersion    = 1
	defaultPostStatus = StatusCleared
)

type PostingStatus string

const (
	StatusPending    PostingStatus = "pending"
	StatusCleared    PostingStatus = "cleared"
	StatusReconciled PostingStatus = "reconciled"
)

type Origin string

const (
	OriginManual   Origin = "manual"
	OriginImport   Origin = "import"
	OriginSchedule Origin = "schedule"
	OriginSystem   Origin = "system"
)

// InstallmentRef places a card posting in an installment plan ("3/12").
type InstallmentRef struct {
	PlanID uuid.UUID
	Number int
	Count  int
}

type Transaction struct {
	ID                uuid.UUID
	BooksID           int64
	Date              time.Time
	Description       string
	PayeeID           uuid.UUID
	BalancingCurrency money.Currency
	Origin            Origin
	Version           int
	VoidedAt          *time.Time
	VoidReason        string
	Postings          []Posting
	Tags              []string
	Links             []Link
	// Trade and Income are the D1 detail of a trade or income transaction (P8 A68, A70).
	Trade  *Trade
	Income *Income
}

// NewTransaction validates t against the accounts its postings reference and returns
// it with defaults applied. accounts must contain every account of the book that a
// posting may reference; a missing id is reported as ErrUnknownAccount.
func NewTransaction(t Transaction, accounts map[uuid.UUID]Account) (Transaction, error) {
	t, err := checkTransactionHeader(t)
	if err != nil {
		return Transaction{}, err
	}

	postings, err := normalizePostings(t, accounts)
	if err != nil {
		return Transaction{}, err
	}

	t.Postings = postings

	tags, err := normalizeTags(t.Tags)
	if err != nil {
		return Transaction{}, err
	}

	t.Tags = tags
	if err := checkLinks(t); err != nil {
		return Transaction{}, err
	}

	return t, nil
}

func checkTransactionHeader(t Transaction) (Transaction, error) {
	if t.Date.IsZero() {
		return Transaction{}, invalid("date", "is required")
	}

	t.Description = strings.TrimSpace(t.Description)
	if utf8.RuneCountInString(t.Description) > maxTextLength {
		return Transaction{}, invalid("description", "must have at most 500 characters")
	}

	if _, err := money.ParseCurrency(string(t.BalancingCurrency)); err != nil {
		return Transaction{}, invalid("balancing_currency", "must be a supported currency")
	}

	switch t.Origin {
	case "":
		t.Origin = OriginManual
	case OriginManual, OriginImport, OriginSchedule, OriginSystem:
	default:
		return Transaction{}, invalid("origin", "is not a known origin")
	}

	if t.Version == 0 {
		t.Version = initialVersion
	}

	return t, nil
}

func normalizePostings(t Transaction, accounts map[uuid.UUID]Account) ([]Posting, error) {
	if len(t.Postings) < 2 {
		return nil, &FieldError{Field: "postings", Message: "at least two postings are required", Err: ErrTooFewPostings}
	}

	if len(t.Postings) > MaxPostings {
		return nil, invalid("postings", fmt.Sprintf("must have at most %d postings", MaxPostings))
	}

	postings := make([]Posting, len(t.Postings))
	var sum int64

	hasCategory := false
	for _, p := range t.Postings {
		if a, ok := accounts[p.AccountID]; ok && (a.Class == ClassIncome || a.Class == ClassExpense) {
			hasCategory = true
		}
	}

	for i, p := range t.Postings {
		checked, err := checkPosting(i, p, t, accounts)
		if err != nil {
			return nil, err
		}

		if checked, err = checkCardPosting(i, checked, accounts[checked.AccountID], hasCategory); err != nil {
			return nil, err
		}

		postings[i] = checked
		// |weight| ≤ 2^53 and at most 500 postings: the sum fits in int64.
		sum += checked.Weight.Amount()
	}

	if sum != 0 {
		return nil, &FieldError{Field: "postings", Message: fmt.Sprintf("weights sum to %d instead of zero", sum), Err: ErrUnbalanced}
	}

	return postings, nil
}

func checkLinks(t Transaction) error {
	for i, l := range t.Links {
		if !slices.Contains(linkTypes, l.Type) {
			return invalid(fmt.Sprintf("links[%d].type", i), "is not a known link type")
		}

		if l.Target == uuid.Nil || l.Target == t.ID {
			return invalid(fmt.Sprintf("links[%d].target", i), "must reference another transaction")
		}

		if l.Amount < 0 || (l.Amount != 0 && l.Type != LinkReimbursementOf) {
			return invalid(fmt.Sprintf("links[%d].amount", i), "must be positive and only on a reimbursement_of link")
		}
	}

	return nil
}

// Correct returns version n+1 of t built from next (DM4).
func (t Transaction) Correct(
	next Transaction,
	expectedVersion int,
	accounts map[uuid.UUID]Account,
) (Transaction, error) {
	if err := t.checkMutable(); err != nil {
		return Transaction{}, err
	}

	if expectedVersion != t.Version {
		return Transaction{}, ErrVersionConflict
	}

	return t.correctTo(next, accounts)
}

// correctTo validates next as the version after t, keeping t's links, record links,
// statement basis and origin where next names none.
func (t Transaction) correctTo(
	next Transaction,
	accounts map[uuid.UUID]Account,
) (Transaction, error) {
	next.ID = t.ID
	next.BooksID = t.BooksID
	next.Version = t.Version + 1
	// A correction that names no links keeps the ones t has; an empty list clears them.
	if next.Links == nil {
		next.Links = t.Links
	}

	postings, err := keepRecordLinks(t.Postings, next.Postings)
	if err != nil {
		return Transaction{}, err
	}

	next.Postings = keepStatementBasis(t.Postings, postings)
	if next.Origin == "" {
		next.Origin = t.Origin
	}

	return NewTransaction(next, accounts)
}

// HasInstallments reports whether a posting of t belongs to an installment plan.
func (t Transaction) HasInstallments() bool {
	return slices.ContainsFunc(t.Postings, func(p Posting) bool { return p.Installment != nil })
}

// CorrectDetails returns the next version of an installment purchase with the description,
// payee and tags of next. Its date and postings change only through refunds, cancellation
// or anticipation, so a next that changes them is refused whole.
func (t Transaction) CorrectDetails(next Transaction, expectedVersion int) (Transaction, error) {
	if err := t.checkMutable(); err != nil {
		return Transaction{}, err
	}

	if expectedVersion != t.Version {
		return Transaction{}, ErrVersionConflict
	}

	var blocked []string
	if !next.Date.Equal(t.Date) {
		blocked = append(blocked, "date")
	}

	same := func(a, b Posting) bool { return a.AccountID == b.AccountID && a.Amount == b.Amount && a.Memo == b.Memo }
	if !slices.EqualFunc(t.Postings, next.Postings, same) {
		blocked = append(blocked, "postings")
	}

	if len(blocked) > 0 {
		return Transaction{}, invalid("transaction_id", "the "+strings.Join(blocked, " and ")+
			" of installment transactions change through refunds, cancellation or anticipation")
	}

	t.Description = strings.TrimSpace(next.Description)
	if utf8.RuneCountInString(t.Description) > maxTextLength {
		return Transaction{}, invalid("description", "must have at most 500 characters")
	}

	tags, err := normalizeTags(next.Tags)
	if err != nil {
		return Transaction{}, err
	}

	t.PayeeID, t.Tags = next.PayeeID, tags
	t.Version++

	return t, nil
}

// keepRecordLinks moves each record link of prev to the first posting of next on the same
// account (P5b amendment A27).
func keepRecordLinks(prev, next []Posting) ([]Posting, error) {
	next = slices.Clone(next)
	for _, p := range prev {
		if p.ExternalRecordID == uuid.Nil {
			continue
		}

		i := slices.IndexFunc(next, func(n Posting) bool { return n.AccountID == p.AccountID && n.ExternalRecordID == uuid.Nil })
		if i < 0 {
			return nil, invalid("postings", "must keep a posting on account "+p.AccountID.String()+", which an imported record confirms")
		}

		next[i].ExternalRecordID = p.ExternalRecordID
	}

	return next, nil
}

// keepStatementBasis keeps the basis of a card posting whose correction names the same
// statement, and the statement an owner or a line chose when the correction names none; a
// statement left to the date is derived again (A136).
func keepStatementBasis(prev, next []Posting) []Posting {
	for k, p := range prev {
		if p.Statement == nil {
			continue
		}

		i := nthOnAccount(next, p.AccountID, ordinalOnAccount(prev, k))
		if i < 0 {
			continue
		}

		s := next[i].Statement
		switch {
		case s != nil && *s == *p.Statement:
			next[i].StatementBasis = p.StatementBasis
		case s == nil && p.StatementBasis != BasisDate && p.StatementBasis != "":
			next[i].Statement, next[i].StatementBasis = p.Statement, p.StatementBasis
		}
	}

	return next
}

func (t Transaction) Void(at time.Time, reason string) (Transaction, error) {
	if err := t.checkMutable(); err != nil {
		return Transaction{}, err
	}

	reason = strings.TrimSpace(reason)
	if utf8.RuneCountInString(reason) > maxTextLength {
		return Transaction{}, invalid("reason", "must have at most 500 characters")
	}

	t.VoidedAt = &at
	t.VoidReason = reason

	return t, nil
}

func (t Transaction) checkMutable() error {
	if t.VoidedAt != nil {
		return ErrVoided
	}

	for _, p := range t.Postings {
		if p.Status == StatusReconciled {
			return ErrReconciled
		}
	}

	return nil
}

package domain

import (
	"fmt"
	"regexp"
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

type LinkType string

const (
	LinkRefundOf        LinkType = "refund_of"
	LinkReimbursementOf LinkType = "reimbursement_of"
	LinkCancellationOf  LinkType = "cancellation_of"
	LinkAnticipationOf  LinkType = "anticipation_of"
	LinkChargebackOf    LinkType = "chargeback_of"
	LinkCorrectionOf    LinkType = "correction_of"
)

var linkTypes = []LinkType{LinkRefundOf, LinkReimbursementOf, LinkCancellationOf, LinkAnticipationOf, LinkChargebackOf, LinkCorrectionOf}

type Link struct {
	Type   LinkType
	Target uuid.UUID
}

type Posting struct {
	ID        uuid.UUID
	AccountID uuid.UUID
	// Amount is in the account currency; Weight is the same value in the
	// transaction's balancing currency (DM1). Weight may be left zero when both
	// currencies are equal; it then defaults to Amount.
	Amount    money.Money
	Weight    money.Money
	Status    PostingStatus
	SettledOn *time.Time
	Original  *money.Money
	Memo      string
}

type Transaction struct {
	ID                uuid.UUID
	UserID            int64
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
}

// NewTransaction validates t against the accounts its postings reference and returns
// it with defaults applied. accounts must contain every account of the user that a
// posting may reference; a missing id is reported as ErrUnknownAccount.
func NewTransaction(t Transaction, accounts map[uuid.UUID]Account) (Transaction, error) {
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
	if len(t.Postings) < 2 {
		return Transaction{}, &FieldError{Field: "postings", Message: "at least two postings are required", Err: ErrTooFewPostings}
	}
	if len(t.Postings) > MaxPostings {
		return Transaction{}, invalid("postings", fmt.Sprintf("must have at most %d postings", MaxPostings))
	}

	postings := make([]Posting, len(t.Postings))
	var sum int64
	for i, p := range t.Postings {
		checked, err := checkPosting(i, p, t, accounts)
		if err != nil {
			return Transaction{}, err
		}
		postings[i] = checked
		// |weight| ≤ 2^53 and at most 500 postings: the sum fits in int64.
		sum += checked.Weight.Amount()
	}
	if sum != 0 {
		return Transaction{}, &FieldError{Field: "postings", Message: fmt.Sprintf("weights sum to %d instead of zero", sum), Err: ErrUnbalanced}
	}
	t.Postings = postings

	tags, err := normalizeTags(t.Tags)
	if err != nil {
		return Transaction{}, err
	}
	t.Tags = tags
	for i, l := range t.Links {
		if !slices.Contains(linkTypes, l.Type) {
			return Transaction{}, invalid(fmt.Sprintf("links[%d].type", i), "is not a known link type")
		}
		if l.Target == uuid.Nil || l.Target == t.ID {
			return Transaction{}, invalid(fmt.Sprintf("links[%d].target", i), "must reference another transaction")
		}
	}
	return t, nil
}

func checkPosting(i int, p Posting, t Transaction, accounts map[uuid.UUID]Account) (Posting, error) {
	field := func(name string) string { return fmt.Sprintf("postings[%d].%s", i, name) }
	a, ok := accounts[p.AccountID]
	if !ok || a.UserID != t.UserID {
		return Posting{}, &FieldError{Field: field("account_id"), Message: "unknown account", Err: ErrUnknownAccount}
	}
	if !a.IsOpenOn(t.Date) {
		return Posting{}, &FieldError{Field: field("account_id"), Message: "account is not open on the transaction date", Err: ErrAccountClosed}
	}
	if p.Amount.Currency() != a.Instrument {
		return Posting{}, invalid(field("amount"), "must be in the account currency "+string(a.Instrument))
	}
	if p.Amount.IsZero() {
		return Posting{}, invalid(field("amount"), "must not be zero")
	}

	if a.Instrument == t.BalancingCurrency {
		if p.Weight == (money.Money{}) {
			p.Weight = p.Amount
		} else if p.Weight != p.Amount {
			return Posting{}, &FieldError{Field: field("weight"), Message: "must equal the amount when the account uses the balancing currency", Err: ErrCurrencyMismatch}
		}
	} else {
		switch {
		case p.Weight.Currency() != t.BalancingCurrency:
			return Posting{}, invalid(field("weight"), "is required in the balancing currency "+string(t.BalancingCurrency))
		case p.Weight.IsZero() || p.Weight.IsNegative() != p.Amount.IsNegative():
			return Posting{}, invalid(field("weight"), "must be non-zero and have the sign of the amount")
		}
	}

	switch p.Status {
	case "":
		p.Status = defaultPostStatus
	case StatusPending, StatusCleared, StatusReconciled:
	default:
		return Posting{}, invalid(field("status"), "must be pending, cleared or reconciled")
	}
	if p.SettledOn != nil && p.SettledOn.Before(t.Date) {
		return Posting{}, invalid(field("settled_on"), "must not be before the transaction date")
	}
	if utf8.RuneCountInString(p.Memo) > maxTextLength {
		return Posting{}, invalid(field("memo"), "must have at most 500 characters")
	}
	return p, nil
}

var tagPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)

// normalizeTags lowercases, turns spaces into hyphens, removes duplicates and sorts.
func normalizeTags(in []string) ([]string, error) {
	out := make([]string, 0, len(in))
	for i, raw := range in {
		tag := strings.ReplaceAll(strings.ToLower(strings.TrimSpace(raw)), " ", "-")
		if len(tag) > maxTagLength || !tagPattern.MatchString(tag) {
			return nil, invalid(fmt.Sprintf("tags[%d]", i), "must use letters a-z, digits and hyphens, up to 60 characters")
		}
		out = append(out, tag)
	}
	slices.Sort(out)
	return slices.Compact(out), nil
}

// Correct returns version n+1 of t built from next (DM4).
func (t Transaction) Correct(next Transaction, expectedVersion int, accounts map[uuid.UUID]Account) (Transaction, error) {
	if err := t.checkMutable(); err != nil {
		return Transaction{}, err
	}
	if expectedVersion != t.Version {
		return Transaction{}, ErrVersionConflict
	}
	next.ID = t.ID
	next.UserID = t.UserID
	next.Version = t.Version + 1
	if next.Origin == "" {
		next.Origin = t.Origin
	}
	return NewTransaction(next, accounts)
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

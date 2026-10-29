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

// Link relates a transaction to another. Amount, when not zero, is the part of the target that a
// reimbursement_of link repays (A117), in the balancing currency of the transaction.
type Link struct {
	Type   LinkType
	Target uuid.UUID
	Amount int64
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

	// Card postings only (I03, I04). Statement is the requested or resolved reference
	// month; StatementID is set by the application once the statement row exists.
	Statement   *ReferenceMonth
	StatementID uuid.UUID
	// StatementBasis is the source that chose Statement: BasisDate, BasisOwner or
	// BasisInstitution (A136).
	StatementBasis string
	CardRole       string
	Installment    *InstallmentRef
	// ExternalRecordID is the imported record this posting confirms (P5b amendment A27).
	ExternalRecordID uuid.UUID
}

// InstallmentRef places a card posting in an installment plan ("3/12").
type InstallmentRef struct {
	PlanID uuid.UUID
	Number int
	Count  int
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
	// Trade and Income are the D1 detail of a trade or income transaction (P8 A68, A70).
	Trade  *Trade
	Income *Income
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
	hasCategory := false
	for _, p := range t.Postings {
		if a, ok := accounts[p.AccountID]; ok && (a.Class == ClassIncome || a.Class == ClassExpense) {
			hasCategory = true
		}
	}
	for i, p := range t.Postings {
		checked, err := checkPosting(i, p, t, accounts)
		if err != nil {
			return Transaction{}, err
		}
		if checked, err = checkCardPosting(i, checked, accounts[checked.AccountID], hasCategory); err != nil {
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
		if l.Amount < 0 || (l.Amount != 0 && l.Type != LinkReimbursementOf) {
			return Transaction{}, invalid(fmt.Sprintf("links[%d].amount", i), "must be positive and only on a reimbursement_of link")
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
	if o := p.Original; o != nil {
		if _, err := money.ParseCurrency(string(o.Currency())); err != nil || o.Currency() == a.Instrument || o.IsZero() || o.IsNegative() != p.Amount.IsNegative() {
			return Posting{}, invalid(field("original"), "must be a non-zero amount of another currency with the sign of the amount")
		}
	}
	if p.SettledOn != nil && p.SettledOn.Before(t.Date) {
		return Posting{}, invalid(field("settled_on"), "must not be before the transaction date")
	}
	if utf8.RuneCountInString(p.Memo) > maxTextLength {
		return Posting{}, invalid(field("memo"), "must have at most 500 characters")
	}
	return p, nil
}

var tagPattern = regexp.MustCompile(`^[\p{L}\p{N}][\p{L}\p{N}-]*$`)

// NormalizeTag normalizes one tag name as normalizeTags does; field names the error.
func NormalizeTag(name, field string) (string, error) {
	tags, err := normalizeTags([]string{name})
	if err != nil {
		return "", invalid(field, "must use letters, digits and hyphens, up to 60 characters")
	}
	return tags[0], nil
}

// normalizeTags lowercases, turns spaces into hyphens, removes duplicates and sorts.
func normalizeTags(in []string) ([]string, error) {
	out := make([]string, 0, len(in))
	for i, raw := range in {
		tag := strings.ReplaceAll(strings.ToLower(strings.TrimSpace(raw)), " ", "-")
		if utf8.RuneCountInString(tag) > maxTagLength || !tagPattern.MatchString(tag) {
			return nil, invalid(fmt.Sprintf("tags[%d]", i), "must use letters, digits and hyphens, up to 60 characters")
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

// ordinalOnAccount is how many postings of ps before index k share the account of ps[k].
func ordinalOnAccount(ps []Posting, k int) int {
	n := 0
	for _, p := range ps[:k] {
		if p.AccountID == ps[k].AccountID {
			n++
		}
	}
	return n
}

// nthOnAccount is the index of the n-th posting of ps on account, or -1.
func nthOnAccount(ps []Posting, account uuid.UUID, n int) int {
	for i, p := range ps {
		if p.AccountID != account {
			continue
		}
		if n == 0 {
			return i
		}
		n--
	}
	return -1
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

// checkCardPosting applies I03/I04 and the role rules: a charge is negative; a credit
// or payment is positive. Without an explicit role, a negative amount is a charge, a
// positive one is a credit when the transaction touches a category, a payment otherwise.
func checkCardPosting(i int, p Posting, a Account, hasCategory bool) (Posting, error) {
	field := func(name string) string { return fmt.Sprintf("postings[%d].%s", i, name) }
	if a.Kind != KindCreditCard {
		if p.Statement != nil || p.CardRole != "" || p.Installment != nil {
			return Posting{}, invalid(field("statement"), "statements, card roles and installments apply to credit card postings only")
		}
		return p, nil
	}
	if p.CardRole == "" {
		switch {
		case p.Amount.IsNegative():
			p.CardRole = RoleCharge
		case hasCategory:
			p.CardRole = RoleCredit
		default:
			p.CardRole = RolePayment
		}
	}
	switch p.CardRole {
	case RoleCharge:
		if !p.Amount.IsNegative() {
			return Posting{}, invalid(field("card_role"), "a charge must be negative")
		}
	case RoleCredit, RolePayment:
		if p.Amount.IsNegative() {
			return Posting{}, invalid(field("card_role"), "a credit or payment must be positive")
		}
	default:
		return Posting{}, invalid(field("card_role"), "must be charge, credit or payment")
	}
	return p, nil
}

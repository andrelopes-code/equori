package domain

import (
	"fmt"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

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

func checkPosting(
	i int,
	p Posting,
	t Transaction,
	accounts map[uuid.UUID]Account,
) (Posting, error) {
	field := func(name string) string { return fmt.Sprintf("postings[%d].%s", i, name) }

	a, ok := accounts[p.AccountID]
	if !ok || a.BooksID != t.BooksID {
		return Posting{}, &FieldError{
			Field:   field("account_id"),
			Message: "unknown account",
			Err:     ErrUnknownAccount,
		}
	}

	if !a.IsOpenOn(t.Date) {
		return Posting{}, &FieldError{
			Field:   field("account_id"),
			Message: "account is not open on the transaction date",
			Err:     ErrAccountClosed,
		}
	}

	if p.Amount.Currency() != a.Instrument {
		return Posting{}, invalid(
			field("amount"),
			"must be in the account currency "+string(a.Instrument),
		)
	}

	if p.Amount.IsZero() {
		return Posting{}, invalid(field("amount"), "must not be zero")
	}

	p, err := checkPostingWeight(p, a, t, field)
	if err != nil {
		return Posting{}, err
	}

	return checkPostingDetails(p, a, t, field)
}

// freeRight reports whether p may hold a zero weight: the units a right issue gives at no cost,
// or an outflow, which takes the cost of the units it removes and finds none on such units
// (coverage row E-06).
func freeRight(p Posting, t Transaction) bool {
	if p.Amount.IsNegative() {
		return true
	}

	return t.CorporateAction != nil && t.CorporateAction.Kind == ActionRightIssue &&
		p.AccountID == t.CorporateAction.NewAccountID
}

func checkPostingWeight(
	p Posting,
	a Account,
	t Transaction,
	field func(string) string,
) (Posting, error) {
	if a.Instrument == t.BalancingCurrency {
		if p.Weight == (money.Money{}) {
			p.Weight = p.Amount
		} else if p.Weight != p.Amount {
			return Posting{}, &FieldError{
				Field:   field("weight"),
				Message: "must equal the amount when the account uses the balancing currency",
				Err:     ErrCurrencyMismatch,
			}
		}
	} else {
		switch {
		case p.Weight.Currency() != t.BalancingCurrency:
			return Posting{}, invalid(
				field("weight"),
				"is required in the balancing currency "+string(t.BalancingCurrency),
			)
		case p.Weight.IsZero() && freeRight(p, t):
		case p.Weight.IsZero() || p.Weight.IsNegative() != p.Amount.IsNegative():
			return Posting{}, invalid(
				field("weight"),
				"must be non-zero and have the sign of the amount",
			)
		}
	}

	return p, nil
}

func checkPostingDetails(
	p Posting,
	a Account,
	t Transaction,
	field func(string) string,
) (Posting, error) {
	switch p.Status {
	case "":
		p.Status = defaultPostStatus
	case StatusPending, StatusCleared, StatusReconciled:
	default:
		return Posting{}, invalid(field("status"), "must be pending, cleared or reconciled")
	}

	if o := p.Original; o != nil {
		if _, err := money.ParseCurrency(
			string(o.Currency()),
		); err != nil || o.Currency() == a.Instrument || o.IsZero() ||
			o.IsNegative() != p.Amount.IsNegative() {
			return Posting{}, invalid(
				field("original"),
				"must be a non-zero amount of another currency with the sign of the amount",
			)
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

// checkCardPosting applies I03/I04 and the role rules: a charge is negative; a credit
// or payment is positive. Without an explicit role, a negative amount is a charge, a
// positive one is a credit when the transaction touches a category, a payment otherwise.
func checkCardPosting(i int, p Posting, a Account, hasCategory bool) (Posting, error) {
	field := func(name string) string { return fmt.Sprintf("postings[%d].%s", i, name) }
	if a.Kind != KindCreditCard {
		if p.Statement != nil || p.CardRole != "" || p.Installment != nil {
			return Posting{}, invalid(
				field("statement"),
				"statements, card roles and installments apply to credit card postings only",
			)
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

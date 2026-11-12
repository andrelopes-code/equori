package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Role is what a segment of a line was read as (A107).
type Role string

const (
	RoleAmount       Role = "amount"
	RoleDate         Role = "date"
	RoleInstallments Role = "installments"
	RoleAccount      Role = "account"
	RoleKind         Role = "kind"
	RoleTag          Role = "tag"
	RoleText         Role = "text"
)

type Kind string

const (
	KindExpense  Kind = "expense"
	KindIncome   Kind = "income"
	KindTransfer Kind = "transfer"
)

// Source tells whether the account was named in the line or is the default account.
type Source string

const (
	SourceText    Source = "text"
	SourceDefault Source = "default"
)

type IssueCode string

const (
	IssueMissingAmount          IssueCode = "missing_amount"
	IssueAmbiguousAmount        IssueCode = "ambiguous_amount"
	IssueInvalidAmount          IssueCode = "invalid_amount"
	IssueInvalidDate            IssueCode = "invalid_date"
	IssueAmbiguousDate          IssueCode = "ambiguous_date"
	IssueInvalidInstallments    IssueCode = "invalid_installments"
	IssueInstallmentsNotAllowed IssueCode = "installments_not_allowed"
	IssueMissingAccount         IssueCode = "missing_account"
	IssueAmbiguousAccount       IssueCode = "ambiguous_account"
	IssueUnknownAccount         IssueCode = "unknown_account"
	IssueMissingDestination     IssueCode = "missing_destination"
	IssueAmbiguousTransfer      IssueCode = "ambiguous_transfer"
	IssueTooManyAccounts        IssueCode = "too_many_accounts"
	IssueSameAccount            IssueCode = "same_account"
	IssueCurrencyMismatch       IssueCode = "currency_mismatch"
	IssuePossibleAccount        IssueCode = "possible_account"
)

// Fields an issue names.
const (
	FieldAmount       = "amount"
	FieldDate         = "date"
	FieldInstallments = "installments"
	FieldAccount      = "account"
	FieldToAccount    = "to_account"
)

// Choice is one reading the owner may pick to settle an issue.
type Choice struct {
	AccountID uuid.UUID
	// Amount is in minor units of the line's currency.
	Amount int64
	// Description is the line's description once the choice is made; Describes is false for a
	// choice that leaves the description as it is.
	Description string
	Describes   bool
}

type Issue struct {
	Code    IssueCode
	Field   string
	Choices []Choice
}

type Segment struct {
	Text string
	Role Role
}

// Line is the draft read from one line of a capture.
type Line struct {
	// Number is the 1-based position of the line among the pieces of the text (A107).
	Number   int
	Text     string
	Segments []Segment
	Kind     Kind
	// Amount is positive, in minor units of Currency; zero when the line has none.
	Amount        int64
	Currency      money.Currency
	Date          time.Time
	AccountID     uuid.UUID
	AccountSource Source
	ToAccountID   uuid.UUID
	// Installments is the count of a card purchase in installments; zero for one payment.
	Installments int
	Description  string
	Tags         []string
	Issues       []Issue
}

// Read reads each non-blank line of text (A107–A113); today is a UTC midnight and
// defaultAccount is uuid.Nil when the owner chose none.
func Read(text string, v Vocabulary, today time.Time, defaultAccount uuid.UUID) []Line {
	idx := indexHandles(v.Accounts)

	var lines []Line
	for n, piece := range SplitLines(text) {
		if t := strings.TrimSpace(piece); t != "" {
			r := &lineReader{
				words:          splitWords(t),
				vocabulary:     v,
				today:          today,
				defaultAccount: defaultAccount,
			}
			lines = append(lines, r.read(n+1, t, idx))
		}
	}

	return lines
}

// SplitLines cuts text at line breaks and semicolons (A107).
func SplitLines(text string) []string {
	return strings.Split(strings.ReplaceAll(text, ";", "\n"), "\n")
}

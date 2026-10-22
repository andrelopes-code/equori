package domain

import (
	"slices"
	"strings"
	"time"
	"unicode/utf8"

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
			r := &lineReader{words: splitWords(t), vocabulary: v, today: today, defaultAccount: defaultAccount}
			lines = append(lines, r.read(n+1, t, idx))
		}
	}
	return lines
}

// SplitLines cuts text at line breaks and semicolons (A107).
func SplitLines(text string) []string {
	return strings.Split(strings.ReplaceAll(text, ";", "\n"), "\n")
}

var (
	transferWords = []string{"transferi", "transferir", "transferencia", "transf", "transfer"}
	incomeWords   = []string{"recebi", "recebido", "ganhei", "received", "income"}
	expenseWords  = []string{"gastei", "paguei", "comprei", "spent", "paid", "bought"}
	connectors    = []string{"de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "em", "com", "para", "pra", "pro", "por"}
)

const maxTagRunes = 60

type lineReader struct {
	words          []word
	vocabulary     Vocabulary
	today          time.Time
	defaultAccount uuid.UUID
	phrases        int
	line           Line
}

func (r *lineReader) mark(first, last int, role Role) {
	for k := first; k < last; k++ {
		r.words[k].role, r.words[k].phrase = role, r.phrases
	}
	r.phrases++
}

func (r *lineReader) issue(code IssueCode, field string, choices ...Choice) {
	r.line.Issues = append(r.line.Issues, Issue{Code: code, Field: field, Choices: choices})
}

// amountAt is an amount phrase and the position of its first word; at is −1 for the
// amount an installment phrase names.
type amountAt struct {
	amountPhrase
	at int
}

func (r *lineReader) read(number int, text string, idx handleIndex) Line {
	r.line = Line{Number: number, Text: text, Date: r.today, Kind: KindExpense}
	r.readTags()
	mentions := r.findMentions(idx)
	installments := r.scan(RoleInstallments, func(i int) (int, any, bool) {
		p, ok := readInstallments(r.words, i)
		return p.words, p, ok
	})
	dates := r.scan(RoleDate, func(i int) (int, any, bool) {
		p, ok := readDate(r.words, i, r.today)
		return p.words, p, ok
	})
	var amounts []amountAt
	for i := 0; i < len(r.words); i++ {
		if !r.words[i].free() {
			continue
		}
		if p, ok := readAmount(r.words, i); ok {
			amounts = append(amounts, amountAt{p, i})
			i += p.words - 1
		}
	}
	transfer, income := r.keywords()
	m, methodConflict := methodOf(r.methods())

	plan := r.readInstallmentPhrases(installments, &amounts)
	r.readDates(dates)
	chosen := r.chooseAmount(amounts)
	if chosen != nil && chosen.sign > 0 {
		income = true
	}
	near := r.findNear(idx)
	r.readAccounts(mentions, transfer, income, m, methodConflict)
	r.settleNear(near)
	r.line.Currency = r.currency()
	r.settleAmount(chosen, amounts)
	r.checkInstallments(plan)
	r.line.Description = r.description(nil)
	r.line.Segments = r.segments(text)
	return r.line
}

func (r *lineReader) readTags() {
	for i, w := range r.words {
		tag, ok := strings.CutPrefix(w.core, "#")
		if n := utf8.RuneCountInString(tag); ok && n >= 1 && n <= maxTagRunes {
			if !slices.Contains(r.line.Tags, tag) {
				r.line.Tags = append(r.line.Tags, tag)
			}
			r.mark(i, i+1, RoleTag)
		}
	}
}

// scan marks every phrase read returns from a free word, left to right.
func (r *lineReader) scan(role Role, read func(i int) (int, any, bool)) []any {
	var out []any
	for i := 0; i < len(r.words); i++ {
		if !r.words[i].free() {
			continue
		}
		if n, p, ok := read(i); ok {
			r.mark(i, i+n, role)
			out = append(out, p)
			i += n - 1
		}
	}
	return out
}

// keywords marks the kind words and reports the transfer and income words found.
func (r *lineReader) keywords() (transfer, income bool) {
	for i, w := range r.words {
		if !w.free() {
			continue
		}
		switch {
		case slices.Contains(transferWords, w.norm):
			transfer = true
		case slices.Contains(incomeWords, w.norm):
			income = true
		case slices.Contains(expenseWords, w.norm):
		default:
			continue
		}
		r.mark(i, i+1, RoleKind)
	}
	return transfer, income
}

func (r *lineReader) methods() []method {
	var named []method
	for i, w := range r.words {
		if m, ok := methodWords[w.norm]; ok && w.free() {
			named = append(named, m)
			r.mark(i, i+1, RoleAccount)
		}
	}
	return named
}

// readInstallmentPhrases returns the installment phrase of the line, and adds the amount a
// phrase like "3x de 19,90" names to amounts as an explicit total.
func (r *lineReader) readInstallmentPhrases(phrases []any, amounts *[]amountAt) *installmentPhrase {
	switch len(phrases) {
	case 0:
		return nil
	case 1:
	default:
		r.issue(IssueInvalidInstallments, FieldInstallments)
		return nil
	}
	p := phrases[0].(installmentPhrase)
	if !p.valid {
		r.issue(IssueInvalidInstallments, FieldInstallments)
		return nil
	}
	if p.each != nil {
		each := *p.each
		if p.count > 1 {
			each.value = each.value.times(int64(p.count))
		}
		each.explicit = true
		*amounts = append(*amounts, amountAt{each, -1})
	}
	return &p
}

func (r *lineReader) readDates(phrases []any) {
	switch len(phrases) {
	case 0:
	case 1:
		if p := phrases[0].(datePhrase); p.valid {
			r.line.Date = p.date
		} else {
			r.issue(IssueInvalidDate, FieldDate)
		}
	default:
		r.issue(IssueAmbiguousDate, FieldDate)
	}
}

// chooseAmount returns the line's amount phrase (A108), nil when the line has none or
// several. Every phrase that may be the amount is marked; the others stay text.
func (r *lineReader) chooseAmount(amounts []amountAt) *amountAt {
	var explicit []amountAt
	for _, a := range amounts {
		if a.explicit {
			explicit = append(explicit, a)
		}
	}
	pool := amounts
	if len(explicit) > 0 {
		pool = explicit
	}
	for _, a := range pool {
		if a.at >= 0 {
			r.mark(a.at, a.at+a.words, RoleAmount)
		}
	}
	if len(pool) == 1 {
		return &pool[0]
	}
	return nil
}

// settleAmount converts the chosen phrase to minor units, or lists the readings when the
// line has several.
func (r *lineReader) settleAmount(chosen *amountAt, amounts []amountAt) {
	scale := r.line.Currency.MinorUnits()
	if chosen != nil {
		if v, ok := chosen.value.minor(scale); ok {
			r.line.Amount = v
		} else {
			r.issue(IssueInvalidAmount, FieldAmount)
		}
		return
	}
	var pool []amountAt
	for _, a := range amounts {
		if a.at >= 0 && r.words[a.at].role == RoleAmount {
			pool = append(pool, a)
		}
	}
	if len(pool) == 0 {
		r.issue(IssueMissingAmount, FieldAmount)
		return
	}
	var choices []Choice
	for _, a := range pool {
		v, ok := a.value.minor(scale)
		if !ok {
			continue
		}
		others := func(i int) bool { return i != a.at && r.words[i].role == RoleAmount && !r.inPhrase(a, i) }
		choices = append(choices, Choice{Amount: v, Description: r.description(others), Describes: true})
	}
	r.issue(IssueAmbiguousAmount, FieldAmount, choices...)
}

func (r *lineReader) inPhrase(a amountAt, i int) bool { return i >= a.at && i < a.at+a.words }

func (r *lineReader) readAccounts(mentions []mention, transfer, income bool, m method, methodConflict bool) {
	if income {
		r.line.Kind = KindIncome
	}
	switch len(mentions) {
	case 0:
		if transfer {
			r.line.Kind = KindTransfer
			r.useDefault()
			r.issue(IssueMissingDestination, FieldToAccount)
			return
		}
		r.byMethod(m, methodConflict)
	case 1:
		one := mentions[0]
		switch {
		case one.destination:
			r.line.Kind = KindTransfer
			r.useDefault()
			r.line.ToAccountID = r.resolve(one.accounts, "", FieldToAccount)
		case transfer:
			r.line.Kind = KindTransfer
			r.setAccount(r.resolve(one.accounts, "", FieldAccount), SourceText)
			r.issue(IssueMissingDestination, FieldToAccount)
		default:
			if methodConflict {
				m = ""
			}
			r.setAccount(r.resolve(one.accounts, m, FieldAccount), SourceText)
		}
	case 2:
		r.line.Kind = KindTransfer
		from, to := mentions[0], mentions[1]
		switch {
		case from.destination && !to.destination:
			from, to = to, from
		case !from.destination && to.destination:
		case !from.destination && !to.destination && to.source && !from.source:
			from, to = to, from
		case !from.destination && !to.destination && from.source && !to.source:
		default:
			r.issue(IssueAmbiguousTransfer, FieldToAccount)
			return
		}
		r.setAccount(r.resolve(from.accounts, "", FieldAccount), SourceText)
		r.line.ToAccountID = r.resolve(to.accounts, "", FieldToAccount)
	default:
		r.issue(IssueTooManyAccounts, FieldAccount)
		return
	}
	r.checkTransfer()
}

// setAccount sets the source account; an unresolved account has no source.
func (r *lineReader) setAccount(id uuid.UUID, source Source) {
	if id != uuid.Nil {
		r.line.AccountID, r.line.AccountSource = id, source
	}
}

func (r *lineReader) useDefault() {
	if r.defaultAccount == uuid.Nil {
		r.issue(IssueMissingAccount, FieldAccount)
		return
	}
	r.line.AccountID, r.line.AccountSource = r.defaultAccount, SourceDefault
}

// byMethod takes the account of a line that names none: the default account when it fits
// the method words, otherwise the only account that fits them.
func (r *lineReader) byMethod(m method, conflict bool) {
	if m == "" && !conflict {
		r.useDefault()
		return
	}
	var fits []int
	for i, a := range r.vocabulary.Accounts {
		if conflict || m.admits(a) {
			if a.ID == r.defaultAccount && !conflict {
				r.line.AccountID, r.line.AccountSource = a.ID, SourceDefault
				return
			}
			fits = append(fits, i)
		}
	}
	r.setAccount(r.resolve(fits, "", FieldAccount), SourceText)
}

// resolve narrows accounts by m and returns the only one left, or records the issue.
func (r *lineReader) resolve(accounts []int, m method, field string) uuid.UUID {
	var left []int
	for _, i := range accounts {
		if m.admits(r.vocabulary.Accounts[i]) {
			left = append(left, i)
		}
	}
	switch len(left) {
	case 0:
		r.issue(IssueUnknownAccount, field)
	case 1:
		return r.vocabulary.Accounts[left[0]].ID
	default:
		choices := make([]Choice, len(left))
		for k, i := range left {
			choices[k] = Choice{AccountID: r.vocabulary.Accounts[i].ID}
		}
		r.issue(IssueAmbiguousAccount, field, choices...)
	}
	return uuid.Nil
}

func (r *lineReader) checkTransfer() {
	if r.line.Kind != KindTransfer || r.line.AccountID == uuid.Nil || r.line.ToAccountID == uuid.Nil {
		return
	}
	if r.line.AccountID == r.line.ToAccountID {
		r.issue(IssueSameAccount, FieldToAccount)
		return
	}
	from, _ := r.vocabulary.account(r.line.AccountID)
	to, _ := r.vocabulary.account(r.line.ToAccountID)
	if from.Currency != to.Currency {
		r.issue(IssueCurrencyMismatch, FieldToAccount)
	}
}

// currency is the currency of the line's account, or the base currency without one.
func (r *lineReader) currency() money.Currency {
	if a, ok := r.vocabulary.account(r.line.AccountID); ok {
		return a.Currency
	}
	return r.vocabulary.Base
}

func (r *lineReader) checkInstallments(p *installmentPhrase) {
	if p == nil || p.count < 2 {
		return
	}
	r.line.Installments = p.count
	if r.line.Kind != KindExpense {
		r.issue(IssueInstallmentsNotAllowed, FieldInstallments)
		return
	}
	if a, ok := r.vocabulary.account(r.line.AccountID); ok && a.Kind != "credit_card" {
		r.issue(IssueInstallmentsNotAllowed, FieldInstallments)
	}
}

// description joins the free words, and the words asText admits, without the connectors at
// either end (A113).
func (r *lineReader) description(asText func(i int) bool) string {
	return r.join(func(i int) bool { return r.words[i].free() || asText != nil && asText(i) })
}

// descriptionOf is the description without the free words keep refuses.
func (r *lineReader) descriptionOf(keep func(i int) bool) string {
	return r.join(func(i int) bool { return r.words[i].free() && (keep == nil || keep(i)) })
}

func (r *lineReader) join(include func(i int) bool) string {
	var parts []string
	for i, w := range r.words {
		if include(i) && w.core != "" {
			parts = append(parts, w.core)
		}
	}
	for len(parts) > 0 && slices.Contains(connectors, Normalize(parts[0])) {
		parts = parts[1:]
	}
	for len(parts) > 0 && slices.Contains(connectors, Normalize(parts[len(parts)-1])) {
		parts = parts[:len(parts)-1]
	}
	return capitalize(strings.Join(parts, " "))
}

// segments cuts text at word and phrase boundaries; the space inside a phrase takes its role.
func (r *lineReader) segments(text string) []Segment {
	var out []Segment
	add := func(s string, role Role) {
		if s == "" {
			return
		}
		if n := len(out); n > 0 && out[n-1].Role == role {
			out[n-1].Text += s
			return
		}
		out = append(out, Segment{Text: s, Role: role})
	}
	for k, w := range r.words {
		role := w.role
		if role == "" {
			role = RoleText
		}
		add(text[w.start:w.end], role)
		if k+1 < len(r.words) {
			gap := RoleText
			if next := r.words[k+1]; w.phrase >= 0 && next.phrase == w.phrase {
				gap = role
			}
			add(text[w.end:r.words[k+1].start], gap)
		}
	}
	return out
}

package domain

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (r *lineReader) readAccounts(
	mentions []mention,
	transfer, income bool,
	m method,
	methodConflict bool,
) {
	if income {
		r.line.Kind = KindIncome
	}

	switch len(mentions) {
	case 0:
		if !r.readNoMention(transfer, m, methodConflict) {
			return
		}
	case 1:
		r.readOneMention(mentions[0], transfer, m, methodConflict)
	case 2:
		if !r.readTwoMentions(mentions[0], mentions[1]) {
			return
		}
	default:
		r.issue(IssueTooManyAccounts, FieldAccount)
		return
	}

	r.checkTransfer()
}

// readNoMention reports false when the line is complete without the transfer check.
func (r *lineReader) readNoMention(transfer bool, m method, methodConflict bool) bool {
	if transfer {
		r.line.Kind = KindTransfer
		r.useDefault()
		r.issue(IssueMissingDestination, FieldToAccount)

		return false
	}

	r.byMethod(m, methodConflict)

	return true
}

func (r *lineReader) readOneMention(one mention, transfer bool, m method, methodConflict bool) {
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
}

// readTwoMentions reports false when the transfer is ambiguous.
func (r *lineReader) readTwoMentions(from, to mention) bool {
	r.line.Kind = KindTransfer

	switch {
	case from.destination && !to.destination:
		from, to = to, from
	case !from.destination && to.destination:
	case !from.destination && !to.destination && to.source && !from.source:
		from, to = to, from
	case !from.destination && !to.destination && from.source && !to.source:
	default:
		r.issue(IssueAmbiguousTransfer, FieldToAccount)
		return false
	}

	r.setAccount(r.resolve(from.accounts, "", FieldAccount), SourceText)
	r.line.ToAccountID = r.resolve(to.accounts, "", FieldToAccount)

	return true
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
	if r.line.Kind != KindTransfer || r.line.AccountID == uuid.Nil ||
		r.line.ToAccountID == uuid.Nil {
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

package domain

import (
	"time"

	"github.com/google/uuid"
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

func (r *lineReader) read(number int, text string, idx handleIndex) Line {
	r.line = Line{Number: number, Text: text, Date: r.today, Kind: KindExpense}
	r.readTags()
	mentions := r.findMentions(idx)
	installments := r.scan(RoleInstallments, func(i int) (int, any, bool) {
		p, ok := readInstallments(r.words, i, r.vocabulary.Lexicon, r.vocabulary.Conventions)
		return p.words, p, ok
	})
	dates := r.scan(RoleDate, func(i int) (int, any, bool) {
		p, ok := readDate(r.words, i, r.today, r.vocabulary.Lexicon, r.vocabulary.Conventions.Order)
		return p.words, p, ok
	})

	var amounts []amountAt
	for i := 0; i < len(r.words); i++ {
		if !r.words[i].free() {
			continue
		}

		if p, ok := readAmount(r.words, i, r.vocabulary.Lexicon, r.vocabulary.Conventions); ok {
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

func (r *lineReader) mark(first, last int, role Role) {
	for k := first; k < last; k++ {
		r.words[k].role, r.words[k].phrase = role, r.phrases
	}

	r.phrases++
}

func (r *lineReader) issue(code IssueCode, field string, choices ...Choice) {
	r.line.Issues = append(r.line.Issues, Issue{Code: code, Field: field, Choices: choices})
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

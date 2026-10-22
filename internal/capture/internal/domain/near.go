package domain

import (
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"
)

// minNearRunes is the shortest word and handle compared by edit distance: below it, one edit
// turns too many ordinary words into account names.
const minNearRunes = 5

// nearWord is a free word one edit away from a single-word handle (A117).
type nearWord struct {
	at          int
	accounts    []int
	destination bool
}

// findNear returns the free words one edit away from a handle, with the accounts that carry
// it. A word that names several handles names their accounts together.
func (r *lineReader) findNear(idx handleIndex) []nearWord {
	var out []nearWord
	for i, w := range r.words {
		if !w.free() || utf8.RuneCountInString(w.norm) < minNearRunes || strings.IndexFunc(w.norm, notLetter) >= 0 {
			continue
		}
		var accounts []int
		for key, ids := range idx.accounts {
			if strings.Contains(key, " ") || utf8.RuneCountInString(key) < minNearRunes || editDistance(w.norm, key) != 1 {
				continue
			}
			for _, id := range ids {
				if !slices.Contains(accounts, id) {
					accounts = append(accounts, id)
				}
			}
		}
		if len(accounts) == 0 {
			continue
		}
		// Map order is random; the choices follow the vocabulary.
		slices.Sort(accounts)
		destination := i > 0 && r.words[i-1].free() && slices.Contains(destinationWords, r.words[i-1].norm)
		out = append(out, nearWord{at: i, accounts: accounts, destination: destination})
	}
	return out
}

func notLetter(r rune) bool { return !unicode.IsLetter(r) }

// editDistance is the optimal string alignment distance: insertions, deletions,
// substitutions and transpositions of adjacent runes each count one.
func editDistance(a, b string) int {
	x, y := []rune(a), []rune(b)
	d := make([][]int, len(x)+1)
	for i := range d {
		d[i] = make([]int, len(y)+1)
		d[i][0] = i
	}
	for j := range d[0] {
		d[0][j] = j
	}
	for i := 1; i <= len(x); i++ {
		for j := 1; j <= len(y); j++ {
			cost := 1
			if x[i-1] == y[j-1] {
				cost = 0
			}
			d[i][j] = min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost)
			if i > 1 && j > 1 && x[i-1] == y[j-2] && x[i-2] == y[j-1] {
				d[i][j] = min(d[i][j], d[i-2][j-2]+1)
			}
		}
	}
	return d[len(x)][len(y)]
}

// settleNear turns an account the line took by default, or did not find, into a question
// when a word is one edit away from a handle (A117).
func (r *lineReader) settleNear(near []nearWord) {
	if len(near) != 1 {
		return
	}
	n := near[0]
	field, missing := FieldAccount, IssueMissingAccount
	if r.line.Kind == KindTransfer && n.destination {
		field, missing = FieldToAccount, IssueMissingDestination
	} else if r.line.AccountSource == SourceText {
		return
	}
	had := slices.ContainsFunc(r.line.Issues, func(i Issue) bool { return i.Code == missing })
	if !had && (field != FieldAccount || r.line.AccountSource != SourceDefault) {
		return
	}
	r.line.Issues = slices.DeleteFunc(r.line.Issues, func(i Issue) bool { return i.Code == missing })
	skip := func(i int) bool { return i != n.at }
	var choices []Choice
	for _, k := range n.accounts {
		choices = append(choices, Choice{AccountID: r.vocabulary.Accounts[k].ID, Description: r.descriptionOf(skip), Describes: true})
	}
	if field == FieldAccount && r.line.AccountSource == SourceDefault &&
		!slices.ContainsFunc(choices, func(c Choice) bool { return c.AccountID == r.line.AccountID }) {
		choices = append(choices, Choice{AccountID: r.line.AccountID, Description: r.descriptionOf(nil), Describes: true})
	}
	r.issue(IssuePossibleAccount, field, choices...)
}

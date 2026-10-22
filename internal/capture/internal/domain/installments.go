package domain

import (
	"regexp"
	"slices"
)

const maxInstallments = 420

var (
	timesWord   = regexp.MustCompile(`^([0-9]{1,3})x$`)
	countNumber = regexp.MustCompile(`^[0-9]{1,3}$`)
)

// installmentPhrase is an installment count read from text (A110). count is 0 for a
// single payment; valid is false for a count outside 1–420.
type installmentPhrase struct {
	count int
	valid bool
	// each is the amount of one installment when the phrase names it ("3x de 19,90").
	each  *amountPhrase
	words int
}

// readInstallments reads the installment phrase that starts at free word i.
func readInstallments(ws []word, i int, lex Lexicon) (installmentPhrase, bool) {
	at := func(j int) string {
		if j < len(ws) && ws[j].free() {
			return ws[j].norm
		}
		return ""
	}
	if lex.isLumpSum(at(i), at(i+1)) {
		return installmentPhrase{valid: true, words: 2}, true
	}
	j := i
	parcelled := false
	if k := slices.Index(lex.InstallmentLeads, at(j)); k >= 0 && at(j) != "" {
		connective := lex.InstallmentLeads[len(lex.InstallmentLeads)-1]
		j++
		if at(j-1) != connective {
			parcelled = true
			if at(j) == connective {
				j++
			}
		}
	}
	n, size := 0, 0
	switch {
	case timesWord.MatchString(at(j)):
		n, size = atoi(timesWord.FindStringSubmatch(at(j))[1]), 1
	case countNumber.MatchString(at(j)) && slices.Contains(lex.CountWords, at(j+1)):
		n, size = atoi(at(j)), 2
	case countNumber.MatchString(at(j)) && parcelled:
		n, size = atoi(at(j)), 1
	default:
		return installmentPhrase{}, false
	}
	p := installmentPhrase{count: n, valid: n >= 1 && n <= maxInstallments, words: j + size - i}
	if n == 1 {
		p.count = 0
	}
	if end := j + size; slices.Contains(lex.Of, at(end)) && at(end+1) != "" {
		if each, ok := readAmount(ws, end+1, lex); ok {
			p.each = &each
			p.words += 1 + each.words
		}
	}
	return p, true
}

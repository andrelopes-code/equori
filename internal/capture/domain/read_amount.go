package domain

// amountAt is an amount phrase and the position of its first word; at is −1 for the
// amount an installment phrase names.
type amountAt struct {
	amountPhrase
	at int
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
		choices = append(
			choices,
			Choice{Amount: v, Description: r.description(others), Describes: true},
		)
	}

	r.issue(IssueAmbiguousAmount, FieldAmount, choices...)
}

func (r *lineReader) inPhrase(a amountAt, i int) bool { return i >= a.at && i < a.at+a.words }

package domain

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

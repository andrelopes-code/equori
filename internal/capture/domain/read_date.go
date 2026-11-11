package domain

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

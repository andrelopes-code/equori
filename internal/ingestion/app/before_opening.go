package app

import (
	"fmt"
	"time"
)

// LinesBeforeOpening refuses a file that would create lines before the account opens (A263);
// FirstLine is the earliest of them.
type LinesBeforeOpening struct{ OpenedOn, FirstLine time.Time }

func (e *LinesBeforeOpening) Error() string {
	return fmt.Sprintf(
		"file: the first line is dated %s and the account opens on %s; move opened_on to import it",
		e.FirstLine.Format(time.DateOnly),
		e.OpenedOn.Format(time.DateOnly),
	)
}

// refusedFile is the error of a file whose line the ledger refused.
func refusedFile(opensOn time.Time, creates []NewLine, rejected *RejectedLine) error {
	first := creates[0].Line.Date
	for _, c := range creates {
		if c.Line.Date.Before(first) {
			first = c.Line.Date
		}
	}

	if first.Before(opensOn) {
		return &LinesBeforeOpening{OpenedOn: opensOn, FirstLine: first}
	}

	line := creates[rejected.Index].Line

	return fileError(
		fmt.Sprintf(
			"line dated %s for %d: %v",
			line.Date.Format(time.DateOnly),
			line.Amount,
			rejected.Reason,
		),
	)
}

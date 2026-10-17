package domain

import (
	"time"

	"github.com/google/uuid"
)

// State is the stored state of an occurrence; overdue is derived (P7 amendment A50).
type State string

const (
	Expected State = "expected"
	Realized State = "realized"
	Skipped  State = "skipped"
	// Overdue is read, never stored: expected and past the schedule's grace days.
	Overdue State = "overdue"
)

type Occurrence struct {
	ID, ScheduleID uuid.UUID
	Sequence       int
	ExpectedOn     time.Time
	Amount         int64
	State          State
	TransactionID  uuid.UUID // uuid.Nil unless realized
	RealizedBy     string    // auto or manual while realized
	MovedFrom      *time.Time
	SkipReason     string
	// DeclinedTransactionID is the transaction the owner released from the occurrence; it no
	// longer realizes it automatically (P7 amendment A51).
	DeclinedTransactionID uuid.UUID
}

// Shown returns the state the API reads on today.
func (o Occurrence) Shown(today time.Time, graceDays int) State {
	if o.State == Expected && today.After(o.ExpectedOn.AddDate(0, 0, graceDays)) {
		return Overdue
	}
	return o.State
}

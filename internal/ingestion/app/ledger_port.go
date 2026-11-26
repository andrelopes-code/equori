package app

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Line is a statement line as the ledger receives it.
type Line struct {
	AccountID    uuid.UUID
	Currency     money.Currency
	Date         time.Time
	Amount       int64
	Description  string
	Pending      bool                   // the aggregator has not settled it (P6 A36)
	DueDate      *time.Time             // due date of the card bill it belongs to (A39)
	Category     *domain.SourceCategory // the aggregator's category (A41)
	TransferTo   *uuid.UUID             // the reserve the line moves money into or out of (A76)
	Retained     int64                  // what TransferTo gives beyond Amount, to Yield (A268)
	Kind         string                 // the card line type the source states (A88)
	Unclassified bool                   // recorded against the uncategorized account without classification (A218 rule 2)
}

// NewLine is a line to record as a transaction for its external record.
type NewLine struct {
	RecordID uuid.UUID
	Line     Line
}

// GroupPart is one line of a group that confirms an entry (A169): its record, amount, date and
// status, and the transaction the import created for it, uuid.Nil for a line without one.
type GroupPart struct {
	RecordID  uuid.UUID
	Amount    int64
	Date      time.Time
	Pending   bool
	CreatedTx uuid.UUID
}

// Match links an external record to the transaction it confirms; a pending line leaves the
// posting pending.
type Match struct {
	RecordID, TransactionID, AccountID uuid.UUID
	Pending                            bool
}

// RejectedLine is a line of a ledger batch that a ledger rule refused; it matches
// ErrLineRejected.
type RejectedLine struct {
	Index  int
	Reason error
}

func (e *RejectedLine) Error() string        { return e.Reason.Error() }
func (e *RejectedLine) Is(target error) bool { return target == ErrLineRejected }

// Counterpart is a transaction a sync line may pair with (A216 rule 2): the posting of
// AccountID that RecordID confirms, and whether the transaction is a card payment (A88).
type Counterpart struct {
	TransactionID, AccountID, RecordID uuid.UUID
	CardPayment                        bool
}

// InstallmentLine is an aggregator card line that belongs to an installment purchase.
type InstallmentLine struct {
	RecordID    uuid.UUID
	Line        Line
	Installment domain.Installment
}

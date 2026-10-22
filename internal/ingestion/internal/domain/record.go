package domain

import "time"

// NormalizedRecord is one statement line in the form every source parser produces.
type NormalizedRecord struct {
	ExternalID  string // the source's own identifier (OFX FITID, CSV id column); empty when absent
	Date        time.Time
	Amount      int64 // minor units, from the account's point of view: negative leaves the account
	Description string
	Raw         map[string]string // the source fields, stored unchanged

	// Aggregator fields (P6 amendments A36, A39, A40, A41).
	Pending      bool       // the source has not settled it yet
	DueDate      *time.Time // due date of the card bill the line belongs to
	Installment  *Installment
	Category     *SourceCategory
	BalanceAfter *int64
	// ReserveName is the reserved balance a bank line moves money into or out of (A76).
	ReserveName string
	// Kind is the type the source states for a card line: KindPayment, KindRefund or empty (A88).
	Kind string
}

// Card line types a source states (A88).
const (
	KindPayment = "payment"
	KindRefund  = "refund"
)

// Installment places a card line in an installment purchase.
type Installment struct {
	Number, Count int
	PurchaseDate  time.Time
	Total         *int64 // the purchase total the source reports, minor units (A90)
}

// SourceCategory is the category the source assigned to a line.
type SourceCategory struct {
	ID, Name string
	// Aggregator is the identifier of the aggregator that assigned it; empty for files.
	Aggregator string
}

// Balance is the balance a file reports at the end of a date.
type Balance struct {
	Date   time.Time
	Amount int64
}

// Statement is the content of one file.
type Statement struct {
	Currency string // empty when the file does not declare it
	From, To *time.Time
	Records  []NormalizedRecord
	Balance  *Balance
}

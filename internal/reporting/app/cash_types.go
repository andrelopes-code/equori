package app

import (
	"time"

	"github.com/google/uuid"
)

// View chooses when an amount counts (docs/domain/02-ubiquitous-language.md).
type View string

const (
	ViewAccrual View = "accrual"
	ViewCash    View = "cash"
)

// CardLine is a charge or credit posting of a card, with the reference month of its
// statement (CV1). Base is true on a card in the base currency (CV6); PlanPurchase is the date
// of the purchase of the line's installment plan; Anticipation marks a line of a transaction
// linked anticipation_of.
type CardLine struct {
	ID, TransactionID, CardID uuid.UUID
	StatementID               uuid.UUID
	Amount                    int64
	Credit                    bool
	Statement                 time.Time
	Base                      bool
	PlanPurchase              *time.Time
	Anticipation              bool
}

// CardPayment is a payment posting of a card. Financing marks the payment of a transaction
// that created a financing plan (CV7).
type CardPayment struct {
	ID, TransactionID, CardID uuid.UUID
	Date                      time.Time
	Amount                    int64
	Financing                 bool
}

// Shares are amounts per category, signed as the category postings.
type Shares map[uuid.UUID]int64

// CardFacts are the card lines and payments of a book, the category postings of the
// transactions that hold the lines or that a line's transaction anticipates or cancels, and
// that purchase per transaction.
type CardFacts struct {
	Lines      []CardLine
	Payments   []CardPayment
	Categories map[uuid.UUID]Shares
	Origins    map[uuid.UUID]uuid.UUID
}

// CashPayment is the amount a card payment gives one category in the cash view, with the
// statement it pays and the payment's transaction (N20, CV10).
type CashPayment struct {
	Date                 time.Time
	Amount               int64
	CardID, StatementID  uuid.UUID
	StatementReference   time.Time
	PaymentTransactionID uuid.UUID
}

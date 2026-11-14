package domain

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// CustodyOrder moves units of one holding to another brokerage with their cost (A228 IO29).
type CustodyOrder struct {
	AccountID, BrokerageID uuid.UUID
	Date                   time.Time
	Quantity               money.Money
	Description            string
}

// BuildCustodyTransfer returns the postings from holding from (h at the end of o.Date) to
// holding to (A228 IO31).
func BuildCustodyTransfer(o CustodyOrder, to uuid.UUID, h Holding) ([]Posting, error) {
	if o.Quantity.IsZero() || o.Quantity.IsNegative() {
		return nil, invalid("quantity", "must be positive")
	}

	if o.Quantity.Currency() != h.Quantity.Currency() {
		return nil, invalid("quantity", "must be in "+string(h.Quantity.Currency()))
	}

	lot, err := soldCost(TradeOrder{Quantity: o.Quantity}, h, nil)
	if err != nil {
		return nil, err
	}

	return []Posting{
		{AccountID: o.AccountID, Amount: o.Quantity.Neg(), Weight: lot.Cost.Neg()},
		{AccountID: to, Amount: o.Quantity, Weight: lot.Cost},
	}, nil
}

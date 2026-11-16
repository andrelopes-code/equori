package domain

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// UnitTaxAccounts are the system accounts a unit tax posts to.
type UnitTaxAccounts struct {
	PrepaidTax, Adjustments uuid.UUID
}

// BuildUnitTax returns the postings and the detail of the unit tax o on holding h, the holding
// at the end of the day before o.Date. The cost basis stays on the remaining units; the tax is
// a credit on prepaid_tax, balanced by adjustments (A236 FC25).
func BuildUnitTax(
	o ActionOrder,
	h Holding,
	base money.Currency,
	accts UnitTaxAccounts,
) ([]Posting, CorporateAction, error) {
	if err := checkUnitTax(o, h, base); err != nil {
		return nil, CorporateAction{}, err
	}

	received, err := h.Quantity.Sub(o.Quantity)
	if err != nil {
		return nil, CorporateAction{}, err
	}

	postings := []Posting{
		{AccountID: o.AccountID, Amount: h.Quantity.Neg(), Weight: h.CostBasis.Neg()},
		{AccountID: o.AccountID, Amount: received, Weight: h.CostBasis},
		{AccountID: accts.PrepaidTax, Amount: o.Amount, Weight: o.Amount},
		{AccountID: accts.Adjustments, Amount: o.Amount.Neg(), Weight: o.Amount.Neg()},
	}

	return postings, CorporateAction{
		AccountID: o.AccountID,
		Kind:      ActionUnitTax,
		RatioFrom: 1,
		RatioTo:   1,
		Held:      h.Quantity,
		Received:  received,
		Value:     o.Amount,
	}, nil
}

func checkUnitTax(o ActionOrder, h Holding, base money.Currency) error {
	switch {
	case h.Quantity.IsZero() || h.Quantity.IsNegative():
		return invalid("account_id", "holds nothing on the day before date")
	case o.RatioFrom != 1:
		return invalid("ratio_from", "must be 1 for a unit tax")
	case o.RatioTo != 1:
		return invalid("ratio_to", "must be 1 for a unit tax")
	case o.Quantity.IsZero() || o.Quantity.IsNegative() ||
		o.Quantity.Amount() >= h.Quantity.Amount():
		return invalid("quantity", "must be positive and below the units held")
	case o.Quantity.Currency() != h.Quantity.Currency():
		return invalid("quantity", "must be in the instrument of the holding")
	case o.Amount.IsZero() || o.Amount.IsNegative():
		return invalid("amount", "must be positive")
	case o.Amount.Currency() != base:
		return invalid("amount", "must be in the base currency")
	}

	return nil
}

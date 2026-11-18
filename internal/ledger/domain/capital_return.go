package domain

import "github.com/google/uuid"

// ActionCapitalReturn keeps the units of a holding, lowers their cost by Amount and pays it into
// CashAccountID: an amortization of an FII, a reduction of the capital of a company (coverage row
// E-08).
const ActionCapitalReturn ActionKind = "capital_return"

// BuildCapitalReturn returns the postings and the detail of a capital return of o on holding h,
// the holding at the end of the day before o.Date: the holding out at its cost and back at its
// cost less o.Amount, and o.Amount into the cash account.
func BuildCapitalReturn(o ActionOrder, h Holding) ([]Posting, CorporateAction, error) {
	switch {
	case o.Kind != ActionCapitalReturn:
		return nil, CorporateAction{}, invalid("kind", "must be capital_return")
	case o.RatioFrom != 1 || o.RatioTo != 1:
		return nil, CorporateAction{}, invalid("ratio_to", "must be 1:1 for a capital return")
	case o.CashAccountID == uuid.Nil:
		return nil, CorporateAction{}, invalid("cash_account_id", "is required")
	case o.Amount.IsZero() || o.Amount.IsNegative():
		return nil, CorporateAction{}, invalid("amount", "is required and must be positive")
	case h.Quantity.IsZero() || h.Quantity.IsNegative():
		return nil, CorporateAction{}, invalid("account_id", "holds nothing on the day before date")
	case o.Amount.Currency() != h.CostBasis.Currency():
		return nil, CorporateAction{}, invalid("amount", "must be in the base currency")
	case o.Amount.Amount() >= h.CostBasis.Amount():
		return nil, CorporateAction{}, invalid("amount", "must be below the cost of the holding")
	}

	kept, err := h.CostBasis.Sub(o.Amount)
	if err != nil {
		return nil, CorporateAction{}, err
	}

	postings := []Posting{
		{AccountID: o.AccountID, Amount: h.Quantity.Neg(), Weight: h.CostBasis.Neg()},
		{AccountID: o.AccountID, Amount: h.Quantity, Weight: kept},
		{AccountID: o.CashAccountID, Amount: o.Amount, Weight: o.Amount},
	}

	return postings, CorporateAction{
		AccountID: o.AccountID,
		Kind:      o.Kind,
		RatioFrom: 1,
		RatioTo:   1,
		Held:      h.Quantity,
		Received:  h.Quantity,
		Value:     o.Amount,
	}, nil
}

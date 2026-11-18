package domain

import (
	"math/big"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

type ActionKind string

const (
	ActionSplit        ActionKind = "split"
	ActionReverseSplit ActionKind = "reverse_split"
	ActionBonus        ActionKind = "bonus"
	ActionUnitTax      ActionKind = "unit_tax"

	// ActionConversion exchanges a whole holding for units of another security: a merger or a
	// ticker change; the cost moves whole (coverage row E-07).
	ActionConversion ActionKind = "conversion"
	// ActionSpinOff keeps the holding and receives units of another security, which take CostBP
	// of its cost, the share the company's notice states (coverage row E-07).
	ActionSpinOff ActionKind = "spin_off"
)

const maxActionRatio = 1000000

// ActionOrder is a split, reverse split, bonus or unit tax of one holding (A228 IO22). Quantity
// (units of the holding) and Amount (base currency) are for a unit tax only.
type ActionOrder struct {
	AccountID, BrokerageID, CategoryID uuid.UUID
	Instrument                         money.Currency
	Kind                               ActionKind
	Date                               time.Time
	RatioFrom, RatioTo                 int64
	UnitCost                           *money.Rate
	Quantity, Amount                   money.Money
	Description                        string

	// NewInstrument is the security a conversion or a spin-off gives; CostBP the basis points of
	// the cost a spin-off moves to it.
	NewInstrument money.Currency
	CostBP        int
}

// CorporateAction is the D1 detail of an action (A228 IO26).
type CorporateAction struct {
	AccountID          uuid.UUID
	Kind               ActionKind
	RatioFrom, RatioTo int64
	Held, Received     money.Money // instrument
	FractionRemainder  int64
	UnitCost           *money.Rate
	Value              money.Money // base currency

	// NewAccountID is the holding of the security a conversion or a spin-off gives, which
	// Received is in; CostBP the share of the cost a spin-off moved.
	NewAccountID uuid.UUID
	CostBP       int
}

// IsExchange reports whether the action gives units of another security.
func (k ActionKind) IsExchange() bool { return k == ActionConversion || k == ActionSpinOff }

// BuildCorporateAction returns the postings and the detail of o on holding h, the holding at
// the end of the day before o.Date, in base currency (A228 IO23 to IO25).
func BuildCorporateAction(
	o ActionOrder,
	h Holding,
	base money.Currency,
) ([]Posting, CorporateAction, error) {
	if err := checkActionOrder(o); err != nil {
		return nil, CorporateAction{}, err
	}

	if h.Quantity.IsZero() || h.Quantity.IsNegative() {
		return nil, CorporateAction{}, invalid("account_id", "holds nothing on the day before date")
	}

	received, remainder, err := actionQuantity(o, h.Quantity)
	if err != nil {
		return nil, CorporateAction{}, err
	}

	value, err := actionValue(o, h.Quantity, received, base)
	if err != nil {
		return nil, CorporateAction{}, err
	}

	newCost, err := h.CostBasis.Add(value)
	if err != nil {
		return nil, CorporateAction{}, err
	}

	postings := []Posting{
		{AccountID: o.AccountID, Amount: h.Quantity.Neg(), Weight: h.CostBasis.Neg()},
		{AccountID: o.AccountID, Amount: received, Weight: newCost},
	}
	if !value.IsZero() {
		postings = append(
			postings,
			Posting{AccountID: o.CategoryID, Amount: value.Neg(), Weight: value.Neg()},
		)
	}

	return postings, CorporateAction{
		AccountID:         o.AccountID,
		Kind:              o.Kind,
		RatioFrom:         o.RatioFrom,
		RatioTo:           o.RatioTo,
		Held:              h.Quantity,
		Received:          received,
		FractionRemainder: remainder,
		UnitCost:          o.UnitCost,
		Value:             value,
	}, nil
}

func checkActionOrder(o ActionOrder) error {
	switch {
	case o.Kind != ActionSplit && o.Kind != ActionReverseSplit && o.Kind != ActionBonus:
		return invalid("kind", "must be split, reverse_split or bonus")
	case o.RatioFrom < 1 || o.RatioFrom > maxActionRatio:
		return invalid("ratio_from", "must be from 1 to 1000000")
	case o.RatioTo < 1 || o.RatioTo > maxActionRatio:
		return invalid("ratio_to", "must be from 1 to 1000000")
	case o.Kind == ActionReverseSplit && o.RatioTo >= o.RatioFrom:
		return invalid("ratio_to", "must be below ratio_from")
	case o.Kind != ActionReverseSplit && o.RatioTo <= o.RatioFrom:
		return invalid("ratio_to", "must be above ratio_from")
	case o.UnitCost != nil && o.Kind != ActionBonus:
		return invalid("unit_cost", "is for a bonus only")
	case o.UnitCost != nil && o.CategoryID == uuid.Nil:
		return invalid("category_id", "is required with unit_cost")
	}

	return nil
}

// actionQuantity returns floor(q × to ÷ from) and the remainder of that division, in minor
// units of the instrument (A228 IO24).
func actionQuantity(o ActionOrder, held money.Money) (money.Money, int64, error) {
	product := new(big.Int).Mul(big.NewInt(held.Amount()), big.NewInt(o.RatioTo))
	quotient, remainder := new(big.Int).QuoRem(product, big.NewInt(o.RatioFrom), new(big.Int))

	if !quotient.IsInt64() || quotient.Sign() == 0 {
		return money.Money{}, 0, invalid("ratio_to", "leaves no unit")
	}

	received, err := money.NewOf(quotient.Int64(), held.Currency(), held.Scale())
	if err != nil {
		return money.Money{}, 0, invalid("ratio_to", "gives a quantity out of range")
	}

	return received, remainder.Int64(), nil
}

// actionValue returns (n − q) × unit cost in base currency; zero without a unit cost.
func actionValue(
	o ActionOrder,
	held, received money.Money,
	base money.Currency,
) (money.Money, error) {
	if o.UnitCost == nil {
		return money.New(0, base)
	}

	added, err := received.Sub(held)
	if err != nil {
		return money.Money{}, err
	}

	return money.Convert(added, base, money.Leg{Rate: *o.UnitCost})
}

// BuildExchange returns the postings and the detail of a conversion or a spin-off of holding h
// into the holding newAccount of o.NewInstrument at the ratio of o, scale the decimals of that
// security. A conversion moves the whole cost; a spin-off keeps the units of h and moves
// o.CostBP of its cost. A fraction of a unit of the new security leaves the position, as in a
// split.
func BuildExchange(
	o ActionOrder,
	h Holding,
	newAccount uuid.UUID,
	scale int,
) ([]Posting, CorporateAction, error) {
	if err := checkExchange(o); err != nil {
		return nil, CorporateAction{}, err
	}

	if h.Quantity.IsZero() || h.Quantity.IsNegative() {
		return nil, CorporateAction{}, invalid("account_id", "holds nothing on the day before date")
	}

	received, remainder, err := exchangeQuantity(o, h.Quantity, scale)
	if err != nil {
		return nil, CorporateAction{}, err
	}

	moved, err := movedCost(o, h.CostBasis)
	if err != nil {
		return nil, CorporateAction{}, err
	}

	zero, err := money.NewOf(0, h.CostBasis.Currency(), h.CostBasis.Scale())
	if err != nil {
		return nil, CorporateAction{}, err
	}

	postings, err := exchangePostings(o, h, newAccount, received, moved)
	if err != nil {
		return nil, CorporateAction{}, err
	}

	return postings, CorporateAction{
		AccountID:         o.AccountID,
		Kind:              o.Kind,
		RatioFrom:         o.RatioFrom,
		RatioTo:           o.RatioTo,
		Held:              h.Quantity,
		Received:          received,
		FractionRemainder: remainder,
		Value:             zero,
		NewAccountID:      newAccount,
		CostBP:            o.CostBP,
	}, nil
}

// exchangePostings take the holding out at its cost, put it back with the cost a spin-off keeps,
// and put the units received in the new holding with the cost moved.
func exchangePostings(
	o ActionOrder,
	h Holding,
	newAccount uuid.UUID,
	received, moved money.Money,
) ([]Posting, error) {
	postings := []Posting{
		{AccountID: o.AccountID, Amount: h.Quantity.Neg(), Weight: h.CostBasis.Neg()},
	}

	if o.Kind == ActionSpinOff {
		kept, err := h.CostBasis.Sub(moved)
		if err != nil {
			return nil, err
		}

		postings = append(
			postings,
			Posting{AccountID: o.AccountID, Amount: h.Quantity, Weight: kept},
		)
	}

	return append(postings, Posting{AccountID: newAccount, Amount: received, Weight: moved}), nil
}

func checkExchange(o ActionOrder) error {
	switch {
	case !o.Kind.IsExchange():
		return invalid("kind", "must be conversion or spin_off")
	case o.NewInstrument == "":
		return invalid("new_instrument", "is required")
	case o.NewInstrument == o.Instrument:
		return invalid("new_instrument", "must be another security")
	case o.RatioFrom < 1 || o.RatioFrom > maxActionRatio:
		return invalid("ratio_from", "must be from 1 to 1000000")
	case o.RatioTo < 1 || o.RatioTo > maxActionRatio:
		return invalid("ratio_to", "must be from 1 to 1000000")
	case o.Kind == ActionSpinOff && (o.CostBP < 1 || o.CostBP > 9999):
		return invalid("cost_bp", "must be from 1 to 9999 for a spin-off")
	case o.Kind == ActionConversion && o.CostBP != 0:
		return invalid("cost_bp", "is for a spin-off only")
	case o.UnitCost != nil:
		return invalid("unit_cost", "is for a bonus only")
	}

	return nil
}

// exchangeQuantity returns floor(units held × to ÷ from) of the new security and the remainder
// of that division, as actionQuantity does; the new security has the scale of the holding.
func exchangeQuantity(o ActionOrder, held money.Money, scale int) (money.Money, int64, error) {
	if scale != held.Scale() {
		return money.Money{}, 0, invalid(
			"new_instrument",
			"must have the decimal places of the holding",
		)
	}

	received, remainder, err := actionQuantity(o, held)
	if err != nil {
		return money.Money{}, 0, err
	}

	received, err = money.NewOf(received.Amount(), o.NewInstrument, scale)
	if err != nil {
		return money.Money{}, 0, invalid("ratio_to", "gives a quantity out of range")
	}

	return received, remainder, nil
}

// movedCost is the cost a conversion or a spin-off moves to the new security, rounded half to even
// to the minor unit of the base currency.
func movedCost(o ActionOrder, cost money.Money) (money.Money, error) {
	if o.Kind == ActionConversion {
		return cost, nil
	}

	return money.Fraction(cost, int64(o.CostBP), 10000)
}

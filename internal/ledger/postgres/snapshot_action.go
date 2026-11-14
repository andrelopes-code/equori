package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type snapshotAction struct {
	AccountID         uuid.UUID `json:"account_id"`
	Kind              string    `json:"kind"`
	RatioFrom         int64     `json:"ratio_from"`
	RatioTo           int64     `json:"ratio_to"`
	Held              int64     `json:"held"`
	Received          int64     `json:"received"`
	FractionRemainder int64     `json:"fraction_remainder"`
	UnitCost          *string   `json:"unit_cost,omitempty"`
	Value             int64     `json:"value"`
}

func toSnapshotAction(a *domain.CorporateAction) *snapshotAction {
	if a == nil {
		return nil
	}

	sa := &snapshotAction{
		AccountID:         a.AccountID,
		Kind:              string(a.Kind),
		RatioFrom:         a.RatioFrom,
		RatioTo:           a.RatioTo,
		Held:              a.Held.Amount(),
		Received:          a.Received.Amount(),
		FractionRemainder: a.FractionRemainder,
		Value:             a.Value.Amount(),
	}
	if a.UnitCost != nil {
		c := a.UnitCost.String()
		sa.UnitCost = &c
	}

	return sa
}

func (sa *snapshotAction) action(
	ctx context.Context,
	ins app.Instruments,
	t domain.Transaction,
) (*domain.CorporateAction, error) {
	if sa == nil {
		return nil, nil
	}

	var instrument money.Currency
	for _, p := range t.Postings {
		if p.AccountID == sa.AccountID {
			instrument = p.Amount.Currency()
		}
	}

	held, err := app.AmountOf(ctx, ins, sa.Held, instrument)
	if err != nil {
		return nil, err
	}

	received, err := app.AmountOf(ctx, ins, sa.Received, instrument)
	if err != nil {
		return nil, err
	}

	value, err := money.New(sa.Value, t.BalancingCurrency)
	if err != nil {
		return nil, err
	}

	a := &domain.CorporateAction{
		AccountID:         sa.AccountID,
		Kind:              domain.ActionKind(sa.Kind),
		RatioFrom:         sa.RatioFrom,
		RatioTo:           sa.RatioTo,
		Held:              held,
		Received:          received,
		FractionRemainder: sa.FractionRemainder,
		Value:             value,
	}
	if sa.UnitCost != nil {
		rate, err := money.ParseRate(*sa.UnitCost)
		if err != nil {
			return nil, err
		}

		a.UnitCost = &rate
	}

	return a, nil
}

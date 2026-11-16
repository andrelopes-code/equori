package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// A236 FC25 (amended 2026-11-18): the cost basis stays and the tax is a credit.
func TestBuildUnitTax(t *testing.T) {
	t.Parallel()

	fund, prepaid, adjustments := uuid.New(), uuid.New(), uuid.New()
	accounts := UnitTaxAccounts{PrepaidTax: prepaid, Adjustments: adjustments}
	h := Holding{Quantity: fundUnits(t, 1000000000), CostBasis: brl(t, 1000000)}
	o := ActionOrder{
		AccountID: fund,
		Kind:      ActionUnitTax,
		RatioFrom: 1,
		RatioTo:   1,
		Quantity:  fundUnits(t, 12500000),
		Amount:    brl(t, 15000),
	}

	postings, action, err := BuildUnitTax(o, h, "BRL", accounts)
	if err != nil {
		t.Fatal(err)
	}

	want := []struct {
		account        uuid.UUID
		amount, weight int64
	}{
		{fund, -1000000000, -1000000},
		{fund, 987500000, 1000000},
		{prepaid, 15000, 15000},
		{adjustments, -15000, -15000},
	}
	if len(postings) != len(want) {
		t.Fatalf("postings = %+v", postings)
	}

	for i, w := range want {
		p := postings[i]
		if p.AccountID != w.account || p.Amount.Amount() != w.amount ||
			p.Weight.Amount() != w.weight {
			t.Fatalf("posting %d = %+v, want %+v", i, p, w)
		}
	}

	if action.Kind != ActionUnitTax || action.Held.Amount() != 1000000000 ||
		action.Received.Amount() != 987500000 || action.Value.Amount() != 15000 ||
		action.RatioFrom != 1 || action.RatioTo != 1 {
		t.Fatalf("action = %+v", action)
	}
}

func TestBuildUnitTaxErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		quantity money.Money
		amount   money.Money
		ratioTo  int64
		field    string
		message  string
	}{
		{"all units", fundUnits(t, 1000000000), brl(t, 15000), 1,
			"quantity", "must be positive and below the units held"},
		{"zero units", fundUnits(t, 0), brl(t, 15000), 1,
			"quantity", "must be positive and below the units held"},
		{"missing units", money.Money{}, brl(t, 15000), 1,
			"quantity", "must be positive and below the units held"},
		{"zero amount", fundUnits(t, 12500000), brl(t, 0), 1,
			"amount", "must be positive"},
		{"missing amount", fundUnits(t, 12500000), money.Money{}, 1,
			"amount", "must be positive"},
		{"ratio", fundUnits(t, 12500000), brl(t, 15000), 2,
			"ratio_to", "must be 1 for a unit tax"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			h := Holding{Quantity: fundUnits(t, 1000000000), CostBasis: brl(t, 1000000)}
			o := ActionOrder{
				Kind: ActionUnitTax, RatioFrom: 1, RatioTo: tt.ratioTo,
				Quantity: tt.quantity, Amount: tt.amount,
			}

			_, _, err := BuildUnitTax(o, h, "BRL", UnitTaxAccounts{})

			var fe *FieldError
			if !errors.As(err, &fe) || fe.Field != tt.field || fe.Message != tt.message {
				t.Fatalf("err = %v, want %s %q", err, tt.field, tt.message)
			}
		})
	}
}

func fundUnits(t *testing.T, n int64) money.Money {
	t.Helper()

	m, err := money.NewOf(n, "FUNDX", 6)
	if err != nil {
		t.Fatal(err)
	}

	return m
}

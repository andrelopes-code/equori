package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestBuildCorporateAction(t *testing.T) {
	t.Parallel()

	account, category := uuid.New(), uuid.New()
	type line struct {
		account        uuid.UUID
		amount, weight int64
	}

	tests := []struct {
		name      string
		order     ActionOrder
		held      int64
		cost      int64
		want      []line
		received  int64
		remainder int64
		value     int64
	}{
		{
			name:  "S431 split keeps the total cost",
			order: ActionOrder{Kind: ActionSplit, RatioFrom: 1, RatioTo: 10},
			held:  100, cost: 100000,
			want:     []line{{account, -100, -100000}, {account, 1000, 100000}},
			received: 1000,
		},
		{
			name:  "S432 reverse split leaves a fraction",
			order: ActionOrder{Kind: ActionReverseSplit, RatioFrom: 10, RatioTo: 1},
			held:  15, cost: 15000,
			want:      []line{{account, -15, -15000}, {account, 1, 15000}},
			received:  1,
			remainder: 5,
		},
		{
			name: "S433 bonus adds the capitalized value",
			order: ActionOrder{
				Kind: ActionBonus, RatioFrom: 10, RatioTo: 11,
				UnitCost: ptr(price(t, "5")), CategoryID: category,
			},
			held: 100, cost: 100000,
			want: []line{
				{account, -100, -100000},
				{account, 110, 105000},
				{category, -5000, -5000},
			},
			received: 110,
			value:    5000,
		},
		{
			name:  "bonus without cost has zero cost",
			order: ActionOrder{Kind: ActionBonus, RatioFrom: 10, RatioTo: 11},
			held:  100, cost: 100000,
			want:     []line{{account, -100, -100000}, {account, 110, 100000}},
			received: 110,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			o := tt.order
			o.AccountID = account
			h := Holding{Quantity: shares(t, tt.held), CostBasis: brl(t, tt.cost)}

			postings, detail, err := BuildCorporateAction(o, h, "BRL")
			if err != nil {
				t.Fatal(err)
			}

			if len(postings) != len(tt.want) {
				t.Fatalf("postings = %+v", postings)
			}

			for i, w := range tt.want {
				p := postings[i]
				if p.AccountID != w.account || p.Amount.Amount() != w.amount ||
					p.Weight.Amount() != w.weight {
					t.Fatalf("posting %d = %+v, want %+v", i, p, w)
				}
			}

			if detail.Held.Amount() != tt.held || detail.Received.Amount() != tt.received ||
				detail.FractionRemainder != tt.remainder || detail.Value.Amount() != tt.value ||
				detail.Kind != o.Kind || detail.AccountID != account {
				t.Fatalf("detail = %+v", detail)
			}
		})
	}
}

func TestBuildCorporateActionErrors(t *testing.T) {
	t.Parallel()

	rate := ptr(price(t, "5"))
	tests := []struct {
		name    string
		order   ActionOrder
		held    int64
		field   string
		message string
	}{
		{"kind", ActionOrder{Kind: "merge", RatioFrom: 1, RatioTo: 2}, 10,
			"kind", "must be split, reverse_split or bonus"},
		{"ratio_from zero", ActionOrder{Kind: ActionSplit, RatioFrom: 0, RatioTo: 2}, 10,
			"ratio_from", "must be from 1 to 1000000"},
		{"ratio_to above max", ActionOrder{Kind: ActionSplit, RatioFrom: 1, RatioTo: 1000001}, 10,
			"ratio_to", "must be from 1 to 1000000"},
		{"split equal", ActionOrder{Kind: ActionSplit, RatioFrom: 2, RatioTo: 2}, 10,
			"ratio_to", "must be above ratio_from"},
		{"bonus below", ActionOrder{Kind: ActionBonus, RatioFrom: 3, RatioTo: 2}, 10,
			"ratio_to", "must be above ratio_from"},
		{"reverse above", ActionOrder{Kind: ActionReverseSplit, RatioFrom: 1, RatioTo: 2}, 10,
			"ratio_to", "must be below ratio_from"},
		{"split with unit cost", ActionOrder{
			Kind: ActionSplit, RatioFrom: 1, RatioTo: 2, UnitCost: rate, CategoryID: uuid.New(),
		}, 10, "unit_cost", "is for a bonus only"},
		{"unit cost without category", ActionOrder{
			Kind: ActionBonus, RatioFrom: 1, RatioTo: 2, UnitCost: rate,
		}, 10, "category_id", "is required with unit_cost"},
		{"nothing held", ActionOrder{Kind: ActionSplit, RatioFrom: 1, RatioTo: 2}, 0,
			"account_id", "holds nothing on the day before date"},
		{"no unit left", ActionOrder{Kind: ActionReverseSplit, RatioFrom: 10, RatioTo: 1}, 5,
			"ratio_to", "leaves no unit"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			h := Holding{Quantity: shares(t, tt.held), CostBasis: brl(t, 1000)}

			_, _, err := BuildCorporateAction(tt.order, h, "BRL")

			var fe *FieldError
			if !errors.As(err, &fe) || fe.Field != tt.field || fe.Message != tt.message {
				t.Fatalf("err = %v, want %s %q", err, tt.field, tt.message)
			}
		})
	}
}

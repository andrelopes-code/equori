package domain

import (
	"reflect"
	"testing"

	"github.com/google/uuid"
)

func TestAccountResults(t *testing.T) {
	t.Parallel()

	a, b := uuid.New(), uuid.New()
	results := []RealizedResult{
		{AccountID: a, Result: 3000, Currency: "BRL"},
		{AccountID: a, Result: -500, Currency: "BRL"},
		{AccountID: b, Result: 2000, Currency: "USD"},
	}
	incomes := []IncomeEvent{
		{AccountID: a, Gross: 4500, Withheld: 788, Currency: "BRL"},
		{AccountID: a, Gross: 1000, Currency: "BRL"},
	}

	got := AccountResults(results, incomes)

	want := map[uuid.UUID]AccountResult{
		a: {
			Realized: &Amount{Units: 2500, Currency: "BRL"},
			Income:   &Amount{Units: 4712, Currency: "BRL"},
		},
		b: {Realized: &Amount{Units: 2000, Currency: "USD"}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("AccountResults = %+v, want %+v", got, want)
	}
}

func TestResultTotals(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		accounts map[uuid.UUID]AccountResult
		realized []Amount
		income   []Amount
	}{
		{"none", nil, []Amount{}, []Amount{}},
		{
			"per currency, ordered by code",
			map[uuid.UUID]AccountResult{
				uuid.New(): {
					Realized: &Amount{Units: 2500, Currency: "USD"},
					Income:   &Amount{Units: 100, Currency: "USD"},
				},
				uuid.New(): {Realized: &Amount{Units: 2000, Currency: "BRL"}},
				uuid.New(): {Realized: &Amount{Units: -300, Currency: "BRL"}},
			},
			[]Amount{{Units: 1700, Currency: "BRL"}, {Units: 2500, Currency: "USD"}},
			[]Amount{{Units: 100, Currency: "USD"}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			realized, income := ResultTotals(tt.accounts)

			if !reflect.DeepEqual(realized, tt.realized) {
				t.Errorf("realized = %+v, want %+v", realized, tt.realized)
			}

			if !reflect.DeepEqual(income, tt.income) {
				t.Errorf("income = %+v, want %+v", income, tt.income)
			}
		})
	}
}

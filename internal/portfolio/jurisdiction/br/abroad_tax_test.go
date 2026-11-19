package br

import (
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// U-08: the financial investments held abroad pay 15% a year on the gains and incomes less the
// losses, which carry to later years; the tax paid abroad is deducted up to the 15% of its own
// income; nothing before 2024 counts (Lei 14.754/2023 art. 2 to 5; RFB Q&A 20, 23 and 45).
func TestAbroadTax(t *testing.T) {
	t.Parallel()

	items := []domain.AbroadItem{
		{Year: 2023, Amount: -900000},
		{Year: 2024, Amount: 100000},
		{Year: 2024, Amount: -300000},
		{Year: 2025, Amount: 500000},
		{Year: 2025, Amount: 100000, Withheld: 30000},
	}

	want := []domain.AbroadYear{
		{Year: 2024, Gains: 100000, Losses: 300000, LossCarried: 200000, RateBP: 1500},
		{
			Year: 2025, Gains: 600000, LossUsed: 200000, Base: 400000, Tax: 60000,
			RateBP: 1500, Credit: 15000, Due: 45000,
		},
	}

	if got := (Jurisdiction{}).AbroadTax(items); !reflect.DeepEqual(got, want) {
		t.Errorf("AbroadTax =\n%+v\nwant\n%+v", got, want)
	}
}

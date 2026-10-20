package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestBuildIncome(t *testing.T) {
	t.Parallel()
	security, cash, category, taxes := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	amount := func(n int64) *money.Money { m := brl(t, n); return &m }
	tests := []struct {
		name     string
		order    IncomeOrder
		want     [][2]any
		withheld int64
	}{
		{name: "S22 dividend", order: IncomeOrder{Type: IncomeDividend, Gross: brl(t, 1000)}, want: [][2]any{{cash, int64(1000)}, {category, int64(-1000)}}},
		{name: "S22 JCP withholds 15 percent by default", order: IncomeOrder{Type: IncomeJCP, Gross: brl(t, 4500)},
			want: [][2]any{{cash, int64(3825)}, {taxes, int64(675)}, {category, int64(-4500)}}, withheld: 675},
		{name: "JCP withholding rounds half to even", order: IncomeOrder{Type: IncomeJCP, Gross: brl(t, 1030)},
			want: [][2]any{{cash, int64(876)}, {taxes, int64(154)}, {category, int64(-1030)}}, withheld: 154},
		{name: "JCP with explicit zero", order: IncomeOrder{Type: IncomeJCP, Gross: brl(t, 4500), Withheld: amount(0)},
			want: [][2]any{{cash, int64(4500)}, {category, int64(-4500)}}},
		{name: "coupon with withholding", order: IncomeOrder{Type: IncomeCoupon, Gross: brl(t, 10000), Withheld: amount(1500)},
			want: [][2]any{{cash, int64(8500)}, {taxes, int64(1500)}, {category, int64(-10000)}}, withheld: 1500},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.order.AccountID, tt.order.CashAccountID, tt.order.CategoryID, tt.order.WithheldCategoryID = security, cash, category, taxes
			postings, income, err := BuildIncome(tt.order)
			if err != nil {
				t.Fatal(err)
			}
			if len(postings) != len(tt.want) {
				t.Fatalf("postings = %+v", postings)
			}
			for i, w := range tt.want {
				if postings[i].AccountID != w[0] || postings[i].Amount.Amount() != w[1] || postings[i].Weight != postings[i].Amount {
					t.Fatalf("posting %d = %+v, want %v", i, postings[i], w)
				}
			}
			if income.Withheld.Amount() != tt.withheld || income.Gross != tt.order.Gross || income.AccountID != security || income.Type != tt.order.Type {
				t.Fatalf("income = %+v", income)
			}
		})
	}
}

func TestBuildIncomeRejects(t *testing.T) {
	t.Parallel()
	amount := func(n int64) *money.Money { m := brl(t, n); return &m }
	tests := []struct {
		name  string
		order IncomeOrder
		field string
	}{
		{name: "unknown type", order: IncomeOrder{Type: "amortization", Gross: brl(t, 100)}, field: "income_type"},
		{name: "zero gross", order: IncomeOrder{Type: IncomeDividend, Gross: brl(t, 0)}, field: "gross"},
		{name: "withheld equal to gross", order: IncomeOrder{Type: IncomeJCP, Gross: brl(t, 100), Withheld: amount(100)}, field: "withheld"},
		{name: "negative withheld", order: IncomeOrder{Type: IncomeJCP, Gross: brl(t, 100), Withheld: amount(-1)}, field: "withheld"},
		{name: "withheld in another currency", order: IncomeOrder{Type: IncomeJCP, Gross: brl(t, 100), Withheld: func() *money.Money { m := mustMoney(t, 1, "USD"); return &m }()}, field: "withheld"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.order.AccountID, tt.order.CashAccountID, tt.order.CategoryID, tt.order.WithheldCategoryID = uuid.New(), uuid.New(), uuid.New(), uuid.New()
			_, _, err := BuildIncome(tt.order)
			var fe *FieldError
			if !errors.As(err, &fe) || fe.Field != tt.field {
				t.Fatalf("err = %v, want field %s", err, tt.field)
			}
		})
	}
}

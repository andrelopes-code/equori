package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func shares(t *testing.T, n int64) money.Money {
	t.Helper()
	m, err := money.NewOf(n, "MXRF11", 0)
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func price(t *testing.T, s string) money.Rate {
	t.Helper()
	r, err := money.ParseRate(s)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestBuildTrade(t *testing.T) {
	security, cash := uuid.New(), uuid.New()
	accts := TradeAccounts{RealizedGains: uuid.New(), RealizedLosses: uuid.New(), Taxes: uuid.New()}
	type line struct {
		account        uuid.UUID
		amount, weight int64
	}
	fee := func(n int64) *money.Money { m := brl(t, n); return &m }
	tests := []struct {
		name    string
		order   TradeOrder
		holding Holding
		want    []line
		cost    int64 // −1: no cost
	}{
		{
			name:  "S21 buy",
			order: TradeOrder{Side: SideBuy, Quantity: shares(t, 150), UnitPrice: price(t, "10.05"), Fees: fee(490)},
			want:  []line{{cash, -151240, -151240}, {security, 150, 151240}},
			cost:  -1,
		},
		{
			name:    "S21 sell",
			order:   TradeOrder{Side: SideSell, Quantity: shares(t, 50), UnitPrice: price(t, "10.80"), Fees: fee(210)},
			holding: Holding{Quantity: shares(t, 150), CostBasis: brl(t, 151240)},
			want:    []line{{cash, 53790, 53790}, {security, -50, -50413}, {accts.RealizedGains, -3377, -3377}},
			cost:    50413,
		},
		{
			name:    "full sale takes the whole cost basis",
			order:   TradeOrder{Side: SideSell, Quantity: shares(t, 3), UnitPrice: price(t, "4")},
			holding: Holding{Quantity: shares(t, 3), CostBasis: brl(t, 1000)},
			want:    []line{{cash, 1200, 1200}, {security, -3, -1000}, {accts.RealizedGains, -200, -200}},
			cost:    1000,
		},
		{
			name:    "one of three",
			order:   TradeOrder{Side: SideSell, Quantity: shares(t, 1), UnitPrice: price(t, "4")},
			holding: Holding{Quantity: shares(t, 3), CostBasis: brl(t, 1000)},
			want:    []line{{cash, 400, 400}, {security, -1, -333}, {accts.RealizedGains, -67, -67}},
			cost:    333,
		},
		{
			name:    "loss with taxes withheld",
			order:   TradeOrder{Side: SideSell, Quantity: shares(t, 10), UnitPrice: price(t, "9"), Fees: fee(100), Taxes: fee(5)},
			holding: Holding{Quantity: shares(t, 10), CostBasis: brl(t, 10000)},
			want:    []line{{cash, 8895, 8895}, {accts.Taxes, 5, 5}, {security, -10, -10000}, {accts.RealizedLosses, 1100, 1100}},
			cost:    10000,
		},
		{
			name:    "no result posting for zero",
			order:   TradeOrder{Side: SideSell, Quantity: shares(t, 10), UnitPrice: price(t, "10")},
			holding: Holding{Quantity: shares(t, 10), CostBasis: brl(t, 10000)},
			want:    []line{{cash, 10000, 10000}, {security, -10, -10000}},
			cost:    10000,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.order.AccountID, tt.order.CashAccountID = security, cash
			if tt.holding.CostBasis == (money.Money{}) {
				tt.holding = Holding{Quantity: shares(t, 0), CostBasis: brl(t, 0)}
			}
			postings, trade, err := BuildTrade(tt.order, "BRL", tt.holding, accts)
			if err != nil {
				t.Fatal(err)
			}
			if len(postings) != len(tt.want) {
				t.Fatalf("postings = %+v", postings)
			}
			for i, w := range tt.want {
				p := postings[i]
				if p.AccountID != w.account || p.Amount.Amount() != w.amount || p.Weight.Amount() != w.weight || p.Weight.Currency() != "BRL" {
					t.Fatalf("posting %d = %+v, want %+v", i, p, w)
				}
			}
			if (trade.Cost == nil) != (tt.cost == -1) || (trade.Cost != nil && trade.Cost.Amount() != tt.cost) {
				t.Fatalf("cost = %v, want %d", trade.Cost, tt.cost)
			}
		})
	}
}

func TestBuildTradeRejects(t *testing.T) {
	accts := TradeAccounts{RealizedGains: uuid.New(), RealizedLosses: uuid.New(), Taxes: uuid.New()}
	held := Holding{Quantity: shares(t, 100), CostBasis: brl(t, 100827)}
	fee := func(n int64) *money.Money { m := brl(t, n); return &m }
	tests := []struct {
		name  string
		order TradeOrder
		field string
	}{
		{name: "sell above holding", order: TradeOrder{Side: SideSell, Quantity: shares(t, 101), UnitPrice: price(t, "10")}, field: "quantity"},
		{name: "zero quantity", order: TradeOrder{Side: SideBuy, Quantity: shares(t, 0), UnitPrice: price(t, "10")}, field: "quantity"},
		{name: "taxes on a buy", order: TradeOrder{Side: SideBuy, Quantity: shares(t, 1), UnitPrice: price(t, "10"), Taxes: fee(1)}, field: "taxes"},
		{name: "negative fees", order: TradeOrder{Side: SideBuy, Quantity: shares(t, 1), UnitPrice: price(t, "10"), Fees: fee(-1)}, field: "fees"},
		{name: "fees above proceeds", order: TradeOrder{Side: SideSell, Quantity: shares(t, 1), UnitPrice: price(t, "10"), Fees: fee(1000)}, field: "fees"},
		{name: "unknown side", order: TradeOrder{Side: "short", Quantity: shares(t, 1), UnitPrice: price(t, "10")}, field: "side"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.order.AccountID, tt.order.CashAccountID = uuid.New(), uuid.New()
			_, _, err := BuildTrade(tt.order, "BRL", held, accts)
			var fe *FieldError
			if !errors.As(err, &fe) || fe.Field != tt.field {
				t.Fatalf("err = %v, want field %s", err, tt.field)
			}
		})
	}
}

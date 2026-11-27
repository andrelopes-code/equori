package domain

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// FC2 to FC6: a trade paid in dollars into a book in reais posts the cash in dollars with the
// weight in reais, and stores its amounts in reais.
func TestBuildTradeWithRate(t *testing.T) {
	t.Parallel()

	security, cash := uuid.New(), uuid.New()
	accts := TradeAccounts{RealizedGains: uuid.New(), RealizedLosses: uuid.New(), Taxes: uuid.New()}
	voo := func(n int64) money.Money {
		m, err := money.NewOf(n, "VOO", 0)
		if err != nil {
			t.Fatal(err)
		}

		return m
	}
	rate := func(s string) *money.Rate { r := price(t, s); return &r }
	usd := func(n int64) *money.Money { m := mustMoney(t, n, "USD"); return &m }
	empty := Holding{Quantity: voo(0), CostBasis: brl(t, 0)}
	held := Holding{Quantity: voo(10), CostBasis: brl(t, 2600520)}
	sameDay := NewDay([]DayTrade{{Side: SideBuy, Quantity: 10, Gross: 2600000, Fees: 520}})

	type line struct {
		account        uuid.UUID
		amount, weight int64
		currency       money.Currency
	}

	tests := []struct {
		name    string
		order   TradeOrder
		holding Holding
		day     *Day
		want    []line
		gross   int64 // reais
		fees    int64 // reais
		cost    int64 // −1: no cost
	}{
		{
			name: "S767 buy",
			order: TradeOrder{
				Side: SideBuy, Quantity: voo(10), UnitPrice: price(t, "500.00"),
				Fees: usd(100), ExchangeRate: rate("5.20"),
			},
			holding: empty,
			want: []line{
				{cash, -500100, -2600520, "USD"},
				{security, 10, 2600520, "VOO"},
			},
			gross: 2600000, fees: 520, cost: -1,
		},
		{
			name: "S772 opening",
			order: TradeOrder{
				Side: SideOpening, Quantity: voo(10), UnitPrice: price(t, "380.00"),
				ExchangeRate: rate("5.40"),
			},
			holding: empty,
			want: []line{
				{security, 10, 2052000, "VOO"},
				{cash, -2052000, -2052000, "BRL"},
			},
			gross: 2052000, fees: 0, cost: -1,
		},
		{
			name: "fees of 0.05 at 5.30 are 26.5 centavos, half to even 26",
			order: TradeOrder{
				Side: SideBuy, Quantity: voo(1), UnitPrice: price(t, "1.00"),
				Fees: usd(5), ExchangeRate: rate("5.30"),
			},
			holding: empty,
			want: []line{
				{cash, -105, -556, "USD"},
				{security, 1, 556, "VOO"},
			},
			gross: 530, fees: 26, cost: -1,
		},
		{
			name: "fees of 0.15 at 5.30 are 79.5 centavos, half to even 80",
			order: TradeOrder{
				Side: SideBuy, Quantity: voo(1), UnitPrice: price(t, "1.00"),
				Fees: usd(15), ExchangeRate: rate("5.30"),
			},
			holding: empty,
			want: []line{
				{cash, -115, -610, "USD"},
				{security, 1, 610, "VOO"},
			},
			gross: 530, fees: 80, cost: -1,
		},
		{
			name: "S769 sell",
			order: TradeOrder{
				Side: SideSell, Quantity: voo(4), UnitPrice: price(t, "600.00"),
				Fees: usd(100), ExchangeRate: rate("5.50"),
			},
			holding: held,
			want: []line{
				{cash, 239900, 1319450, "USD"},
				{security, -4, -1040208, "VOO"},
				{accts.RealizedGains, -279242, -279242, "BRL"},
			},
			gross: 1320000, fees: 550, cost: 1040208,
		},
		{
			name: "FC6 a sale separates no day trade",
			order: TradeOrder{
				Side: SideSell, Quantity: voo(4), UnitPrice: price(t, "600.00"),
				Fees: usd(100), ExchangeRate: rate("5.50"),
			},
			holding: held,
			day:     &sameDay,
			want: []line{
				{cash, 239900, 1319450, "USD"},
				{security, -4, -1040208, "VOO"},
				{accts.RealizedGains, -279242, -279242, "BRL"},
			},
			gross: 1320000, fees: 550, cost: 1040208,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.order.AccountID, tt.order.CashAccountID = security, cash

			postings, trade, err := BuildTrade(tt.order, "USD", tt.holding, tt.day, accts)
			if err != nil {
				t.Fatal(err)
			}

			if len(postings) != len(tt.want) {
				t.Fatalf("postings = %+v", postings)
			}

			for i, w := range tt.want {
				p := postings[i]
				if p.AccountID != w.account || p.Amount.Amount() != w.amount ||
					p.Amount.Currency() != w.currency || p.Weight.Amount() != w.weight ||
					p.Weight.Currency() != "BRL" {
					t.Fatalf("posting %d = %+v, want %+v", i, p, w)
				}
			}

			if trade.Gross != brl(t, tt.gross) || trade.Fees != brl(t, tt.fees) ||
				trade.Taxes != brl(t, 0) {
				t.Fatalf("amounts = %v %v %v, want %d %d 0", trade.Gross, trade.Fees, trade.Taxes,
					tt.gross, tt.fees)
			}

			if trade.ExchangeRate == nil || *trade.ExchangeRate != *tt.order.ExchangeRate {
				t.Fatalf("rate = %v, want %v", trade.ExchangeRate, tt.order.ExchangeRate)
			}

			if (trade.Cost == nil) != (tt.cost == -1) ||
				(trade.Cost != nil && trade.Cost.Amount() != tt.cost) {
				t.Fatalf("cost = %v, want %d", trade.Cost, tt.cost)
			}

			if !trade.DayTradeQuantity.IsZero() || !trade.DayTradeCost.IsZero() {
				t.Fatalf("day trade = %v %v, want zero", trade.DayTradeQuantity, trade.DayTradeCost)
			}
		})
	}
}

func TestBuildTradeRateWithCashInBase(t *testing.T) {
	t.Parallel()

	r := price(t, "5.20")
	o := TradeOrder{
		AccountID: uuid.New(), CashAccountID: uuid.New(), Side: SideBuy,
		Quantity: shares(t, 10), UnitPrice: price(t, "10.00"), ExchangeRate: &r,
	}
	h := Holding{Quantity: shares(t, 0), CostBasis: brl(t, 0)}

	_, _, err := BuildTrade(o, "BRL", h, nil, TradeAccounts{})

	var fe *FieldError
	if !errors.As(err, &fe) || fe.Field != "exchange_rate" {
		t.Fatalf("err = %v, want a field error on exchange_rate", err)
	}
}

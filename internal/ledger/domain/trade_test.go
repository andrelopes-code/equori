package domain

import (
	"errors"
	"testing"
	"time"

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
	t.Parallel()

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
			name: "S21 buy",
			order: TradeOrder{
				Side:      SideBuy,
				Quantity:  shares(t, 150),
				UnitPrice: price(t, "10.05"),
				Fees:      fee(490),
			},
			want: []line{{cash, -151240, -151240}, {security, 150, 151240}},
			cost: -1,
		},
		{
			name: "S21 sell",
			order: TradeOrder{
				Side:      SideSell,
				Quantity:  shares(t, 50),
				UnitPrice: price(t, "10.80"),
				Fees:      fee(210),
			},
			holding: Holding{Quantity: shares(t, 150), CostBasis: brl(t, 151240)},
			want: []line{
				{cash, 53790, 53790},
				{security, -50, -50413},
				{accts.RealizedGains, -3377, -3377},
			},
			cost: 50413,
		},
		{
			name:    "full sale takes the whole cost basis",
			order:   TradeOrder{Side: SideSell, Quantity: shares(t, 3), UnitPrice: price(t, "4")},
			holding: Holding{Quantity: shares(t, 3), CostBasis: brl(t, 1000)},
			want: []line{
				{cash, 1200, 1200},
				{security, -3, -1000},
				{accts.RealizedGains, -200, -200},
			},
			cost: 1000,
		},
		{
			name:    "one of three",
			order:   TradeOrder{Side: SideSell, Quantity: shares(t, 1), UnitPrice: price(t, "4")},
			holding: Holding{Quantity: shares(t, 3), CostBasis: brl(t, 1000)},
			want: []line{
				{cash, 400, 400},
				{security, -1, -333},
				{accts.RealizedGains, -67, -67},
			},
			cost: 333,
		},
		{
			name: "loss with taxes withheld",
			order: TradeOrder{
				Side:      SideSell,
				Quantity:  shares(t, 10),
				UnitPrice: price(t, "9"),
				Fees:      fee(100),
				Taxes:     fee(5),
			},
			holding: Holding{Quantity: shares(t, 10), CostBasis: brl(t, 10000)},
			want: []line{
				{cash, 8895, 8895},
				{accts.Taxes, 5, 5},
				{security, -10, -10000},
				{accts.RealizedLosses, 1100, 1100},
			},
			cost: 10000,
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

			postings, trade, err := BuildTrade(tt.order, "BRL", tt.holding, nil, accts)
			if err != nil {
				t.Fatal(err)
			}

			if len(postings) != len(tt.want) {
				t.Fatalf("postings = %+v", postings)
			}

			for i, w := range tt.want {
				p := postings[i]
				if p.AccountID != w.account || p.Amount.Amount() != w.amount ||
					p.Weight.Amount() != w.weight ||
					p.Weight.Currency() != "BRL" {
					t.Fatalf("posting %d = %+v, want %+v", i, p, w)
				}
			}

			if (trade.Cost == nil) != (tt.cost == -1) ||
				(trade.Cost != nil && trade.Cost.Amount() != tt.cost) {
				t.Fatalf("cost = %v, want %d", trade.Cost, tt.cost)
			}
		})
	}
}

func TestBuildTradeSettlement(t *testing.T) {
	t.Parallel()

	security, cash := uuid.New(), uuid.New()
	accts := TradeAccounts{RealizedGains: uuid.New(), RealizedLosses: uuid.New(), Taxes: uuid.New()}
	date := time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC)
	later := time.Date(2026, 11, 24, 0, 0, 0, 0, time.UTC)
	fee := brl(t, 100)

	tests := []struct {
		name       string
		order      TradeOrder
		holding    Holding
		settlement *time.Time
	}{
		{
			name:       "buy settles later",
			order:      TradeOrder{Side: SideBuy, SettlementDate: &later},
			settlement: &later,
		},
		{
			name:  "buy settling on the date",
			order: TradeOrder{Side: SideBuy, SettlementDate: &date},
		},
		{
			name:  "buy without a settlement date",
			order: TradeOrder{Side: SideBuy},
		},
		{
			name:       "sale with fees settles later on the cash posting only",
			order:      TradeOrder{Side: SideSell, Fees: &fee, SettlementDate: &later},
			holding:    Holding{Quantity: shares(t, 10), CostBasis: brl(t, 10000)},
			settlement: &later,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.order.AccountID, tt.order.CashAccountID = security, cash
			tt.order.Date = date
			tt.order.Quantity = shares(t, 10)
			tt.order.UnitPrice = price(t, "10")

			postings, _, err := BuildTrade(tt.order, "BRL", tt.holding, nil, accts)
			if err != nil {
				t.Fatal(err)
			}

			for _, p := range postings {
				want := (*time.Time)(nil)
				if p.AccountID == cash {
					want = tt.settlement
				}

				if (p.SettledOn == nil) != (want == nil) ||
					(want != nil && !p.SettledOn.Equal(*want)) {
					t.Errorf("posting %s settled_on = %v, want %v", p.AccountID, p.SettledOn, want)
				}
			}
		})
	}
}

func TestBuildTradeRejects(t *testing.T) {
	t.Parallel()

	accts := TradeAccounts{RealizedGains: uuid.New(), RealizedLosses: uuid.New(), Taxes: uuid.New()}
	held := Holding{Quantity: shares(t, 100), CostBasis: brl(t, 100827)}
	fee := func(n int64) *money.Money { m := brl(t, n); return &m }

	tests := []struct {
		name  string
		order TradeOrder
		field string
	}{
		{
			name:  "sell above holding",
			order: TradeOrder{Side: SideSell, Quantity: shares(t, 101), UnitPrice: price(t, "10")},
			field: "quantity",
		},
		{
			name:  "zero quantity",
			order: TradeOrder{Side: SideBuy, Quantity: shares(t, 0), UnitPrice: price(t, "10")},
			field: "quantity",
		},
		{
			name: "taxes on a buy",
			order: TradeOrder{
				Side:      SideBuy,
				Quantity:  shares(t, 1),
				UnitPrice: price(t, "10"),
				Taxes:     fee(1),
			},
			field: "taxes",
		},
		{
			name: "negative fees",
			order: TradeOrder{
				Side:      SideBuy,
				Quantity:  shares(t, 1),
				UnitPrice: price(t, "10"),
				Fees:      fee(-1),
			},
			field: "fees",
		},
		{
			name: "fees above proceeds",
			order: TradeOrder{
				Side:      SideSell,
				Quantity:  shares(t, 1),
				UnitPrice: price(t, "10"),
				Fees:      fee(1000),
			},
			field: "fees",
		},
		{
			name:  "unknown side",
			order: TradeOrder{Side: "short", Quantity: shares(t, 1), UnitPrice: price(t, "10")},
			field: "side",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.order.AccountID, tt.order.CashAccountID = uuid.New(), uuid.New()
			_, _, err := BuildTrade(tt.order, "BRL", held, nil, accts)

			var fe *FieldError
			if !errors.As(err, &fe) || fe.Field != tt.field {
				t.Fatalf("err = %v, want field %s", err, tt.field)
			}
		})
	}
}

// A228 IO11 to IO13, S423 to S425 and the partial buy: a sale closes the day's purchases first.
func TestBuildTradeDay(t *testing.T) {
	t.Parallel()

	security, cash := uuid.New(), uuid.New()
	accts := TradeAccounts{RealizedGains: uuid.New(), RealizedLosses: uuid.New(), Taxes: uuid.New()}
	buys := func(b ...DayBuy) []DayBuy { return b }

	tests := []struct {
		name            string
		quantity        int64
		held, basis     int64
		day             *Day
		cost, dtQty, dt int64
	}{
		{
			// S423: the 50 sold close the 50 bought; dt cost is the whole buy.
			name: "S423 sale equals the day buy", quantity: 50, held: 150, basis: 160000,
			day:  &Day{Buys: buys(DayBuy{50, 60000})},
			cost: 60000, dtQty: 50, dt: 60000,
		},
		{
			// S424: dt 30 at 36000; swing 20 of the stock 100 / 100000 = 20000; total 56000.
			name: "S424 day trade and swing", quantity: 50, held: 130, basis: 136000,
			day:  &Day{Buys: buys(DayBuy{30, 36000})},
			cost: 56000, dtQty: 30, dt: 36000,
		},
		{
			// S425 first sale: the first buy (10, 300200) pairs with the first sale of 10.
			name: "S425 first sale", quantity: 10, held: 15, basis: 450400,
			day:  &Day{Buys: buys(DayBuy{10, 300200}, DayBuy{5, 150200})},
			cost: 300200, dtQty: 10, dt: 300200,
		},
		{
			// S425 second sale: matched 10 leaves the second buy (5, 150200).
			name: "S425 second sale", quantity: 5, held: 5, basis: 150200,
			day:  &Day{Buys: buys(DayBuy{10, 300200}, DayBuy{5, 150200}), Matched: 10},
			cost: 150200, dtQty: 5, dt: 150200,
		},
		{
			// F(1) = Fraction(1000, 1, 3) = 333.
			name: "partial buy first", quantity: 1, held: 3, basis: 1000,
			day:  &Day{Buys: buys(DayBuy{3, 1000})},
			cost: 333, dtQty: 1, dt: 333,
		},
		{
			// F(2) - F(1) = 667 - 333 = 334.
			name: "partial buy second", quantity: 1, held: 2, basis: 667,
			day:  &Day{Buys: buys(DayBuy{3, 1000}), Matched: 1},
			cost: 334, dtQty: 1, dt: 334,
		},
		{
			// F(3) - F(2) = 1000 - 667 = 333; the three costs add up to 1000.
			name: "partial buy third", quantity: 1, held: 1, basis: 333,
			day:  &Day{Buys: buys(DayBuy{3, 1000}), Matched: 2},
			cost: 333, dtQty: 1, dt: 333,
		},
		{
			// No buy on the date: the average cost 1000 x 40 / 100 = 400 (A68).
			name: "no day buys", quantity: 40, held: 100, basis: 1000,
			day:  &Day{},
			cost: 400,
		},
		{
			// S426 numbers without a Day: 160000 x 50 / 150 = 53333.33.
			name: "nil day keeps the average", quantity: 50, held: 150, basis: 160000,
			cost: 53333,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			order := TradeOrder{
				AccountID: security, CashAccountID: cash, Side: SideSell,
				Quantity: shares(t, tt.quantity), UnitPrice: price(t, "10"),
			}
			held := Holding{Quantity: shares(t, tt.held), CostBasis: brl(t, tt.basis)}

			_, trade, err := BuildTrade(order, "BRL", held, tt.day, accts)
			if err != nil {
				t.Fatal(err)
			}

			if trade.Cost == nil || trade.Cost.Amount() != tt.cost ||
				trade.DayTradeQuantity.Amount() != tt.dtQty ||
				trade.DayTradeCost.Amount() != tt.dt {
				t.Fatalf(
					"cost %v, day trade %v at %v, want %d, %d at %d",
					trade.Cost,
					trade.DayTradeQuantity,
					trade.DayTradeCost,
					tt.cost,
					tt.dtQty,
					tt.dt,
				)
			}
		})
	}
}

func TestNewDay(t *testing.T) {
	t.Parallel()

	got := NewDay([]DayTrade{
		{Side: SideBuy, Quantity: 10, Gross: 3000, Fees: 20},
		{Side: SideSell, Quantity: 8, DayTradeQuantity: 6},
		{Side: SideBuy, Quantity: 5, Gross: 1500, Fees: 0},
		{Side: SideSell, Quantity: 2, DayTradeQuantity: 2},
	})

	if len(got.Buys) != 2 || got.Buys[0] != (DayBuy{10, 3020}) ||
		got.Buys[1] != (DayBuy{5, 1500}) || got.Matched != 8 {
		t.Fatalf("day = %+v", got)
	}
}

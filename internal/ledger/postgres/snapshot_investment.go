package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// snapshotTrade and snapshotIncome keep the detail a correction replaces (A227 IC8). Amounts
// are minor units: the quantity of the security, the rest of currency.
type snapshotTrade struct {
	AccountID     uuid.UUID `json:"account_id"`
	CashAccountID uuid.UUID `json:"cash_account_id"`
	Side          string    `json:"side"`
	Quantity      int64     `json:"quantity"`
	Instrument    string    `json:"instrument"`
	UnitPrice     string    `json:"unit_price"`
	Gross         int64     `json:"gross"`
	Fees          int64     `json:"fees"`
	Taxes         int64     `json:"taxes"`
	Cost          *int64    `json:"cost,omitempty"`
	Currency      string    `json:"currency"`
	ExchangeRate  string    `json:"exchange_rate,omitempty"`

	DayTradeQuantity int64 `json:"day_trade_quantity,omitempty"`
	DayTradeCost     int64 `json:"day_trade_cost,omitempty"`
}

type snapshotIncome struct {
	AccountID     uuid.UUID `json:"account_id"`
	CashAccountID uuid.UUID `json:"cash_account_id"`
	Type          string    `json:"type"`
	Gross         int64     `json:"gross"`
	Withheld      int64     `json:"withheld"`
	Currency      string    `json:"currency"`
	ExchangeRate  string    `json:"exchange_rate,omitempty"`
}

func toSnapshotTrade(tr *domain.Trade) *snapshotTrade {
	if tr == nil {
		return nil
	}

	st := &snapshotTrade{
		AccountID:     tr.AccountID,
		CashAccountID: tr.CashAccountID,
		Side:          string(tr.Side),
		Quantity:      tr.Quantity.Amount(),
		Instrument:    string(tr.Quantity.Currency()),
		UnitPrice:     tr.UnitPrice.String(),
		Gross:         tr.Gross.Amount(),
		Fees:          tr.Fees.Amount(),
		Taxes:         tr.Taxes.Amount(),
		Currency:      string(tr.Gross.Currency()),

		DayTradeQuantity: tr.DayTradeQuantity.Amount(),
		DayTradeCost:     tr.DayTradeCost.Amount(),
	}
	if tr.Cost != nil {
		c := tr.Cost.Amount()
		st.Cost = &c
	}

	if tr.ExchangeRate != nil {
		st.ExchangeRate = tr.ExchangeRate.String()
	}

	return st
}

func toSnapshotIncome(in *domain.Income) *snapshotIncome {
	if in == nil {
		return nil
	}

	si := &snapshotIncome{
		AccountID:     in.AccountID,
		CashAccountID: in.CashAccountID,
		Type:          string(in.Type),
		Gross:         in.Gross.Amount(),
		Withheld:      in.Withheld.Amount(),
		Currency:      string(in.Gross.Currency()),
	}
	if in.ExchangeRate != nil {
		si.ExchangeRate = in.ExchangeRate.String()
	}

	return si
}

func (st *snapshotTrade) trade(ctx context.Context, ins app.Instruments) (*domain.Trade, error) {
	if st == nil {
		return nil, nil
	}

	quantity, err := app.AmountOf(ctx, ins, st.Quantity, money.Currency(st.Instrument))
	if err != nil {
		return nil, err
	}

	// A write-off carries no price; the archive holds it as zero (listed options design W3).
	var price money.Rate
	if domain.Side(st.Side) != domain.SideWriteOff {
		if price, err = money.ParseRate(st.UnitPrice); err != nil {
			return nil, err
		}
	}

	dayQuantity, err := app.AmountOf(ctx, ins, st.DayTradeQuantity, money.Currency(st.Instrument))
	if err != nil {
		return nil, err
	}

	tr := &domain.Trade{
		DayTradeQuantity: dayQuantity,
		AccountID:        st.AccountID,
		CashAccountID:    st.CashAccountID,
		Side:             domain.Side(st.Side),
		Quantity:         quantity,
		UnitPrice:        price,
	}

	if err := st.setAmounts(tr); err != nil {
		return nil, err
	}

	if tr.ExchangeRate, err = parseOptionalRate(st.ExchangeRate); err != nil {
		return nil, err
	}

	return tr, nil
}

// setAmounts converts the money fields of st into tr.
func (st *snapshotTrade) setAmounts(tr *domain.Trade) error {
	var err error

	cur := money.Currency(st.Currency)
	for _, x := range []struct {
		to *money.Money
		v  int64
	}{
		{&tr.Gross, st.Gross}, {&tr.Fees, st.Fees}, {&tr.Taxes, st.Taxes},
		{&tr.DayTradeCost, st.DayTradeCost},
	} {
		if *x.to, err = money.New(x.v, cur); err != nil {
			return err
		}
	}

	if st.Cost != nil {
		cost, err := money.New(*st.Cost, cur)
		if err != nil {
			return err
		}

		tr.Cost = &cost
	}

	return nil
}

func (si *snapshotIncome) income() (*domain.Income, error) {
	if si == nil {
		return nil, nil
	}

	cur := money.Currency(si.Currency)

	gross, err := money.New(si.Gross, cur)
	if err != nil {
		return nil, err
	}

	withheld, err := money.New(si.Withheld, cur)
	if err != nil {
		return nil, err
	}

	rate, err := parseOptionalRate(si.ExchangeRate)
	if err != nil {
		return nil, err
	}

	return &domain.Income{
		AccountID:     si.AccountID,
		CashAccountID: si.CashAccountID,
		Type:          domain.IncomeType(si.Type),
		Gross:         gross,
		Withheld:      withheld,
		ExchangeRate:  rate,
	}, nil
}

// parseOptionalRate returns nil for an empty s, else its rate.
func parseOptionalRate(s string) (*money.Rate, error) {
	if s == "" {
		return nil, nil
	}

	rate, err := money.ParseRate(s)
	if err != nil {
		return nil, err
	}

	return &rate, nil
}

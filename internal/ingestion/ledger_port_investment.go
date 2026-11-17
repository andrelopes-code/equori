package ingestion

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	undoReason     = "aggregator item undone"
	unitPriceScale = 12
)

func (p ledgerPort) ApplyInvestment(
	ctx context.Context,
	booksID int64,
	in app.InvestmentApplication,
) (app.AppliedInvestment, error) {
	a := ledger.FixedIncomeApplication{
		ApplicationID: in.ApplicationID,
		BrokerageID:   in.BrokerageID,
		CashAccountID: in.CashAccountID,
		AppliedOn:     in.On,
		Amount:        in.Amount,
		Instrument:    in.Instrument,
	}

	if in.Instrument == "" {
		a.Contract = &ledger.Contract{
			Subtype:          in.Subtype,
			Name:             in.Name,
			IssuerName:       in.Issuer,
			IssuerScheme:     in.IssuerScheme,
			IssuerID:         in.IssuerID,
			IndexID:          in.IndexID,
			PercentOfIndexBP: in.PercentOfIndexBP,
			SpreadBP:         in.SpreadBP,
			IssuedOn:         in.IssuedOn,
			MaturesOn:        in.MaturesOn,
		}
	}

	res, err := p.l.ApplyFixedIncome(ctx, booksID, a)
	if err != nil {
		return app.AppliedInvestment{}, p.refusal(err)
	}

	tx, err := p.l.Transaction(ctx, booksID, res.TransactionID)
	if err != nil {
		return app.AppliedInvestment{}, p.translate(err)
	}

	if tx.Trade == nil {
		return app.AppliedInvestment{}, fmt.Errorf("transaction %s has no trade", tx.ID)
	}

	return app.AppliedInvestment{
		TransactionID: res.TransactionID,
		AccountID:     tx.Trade.AccountID,
		Instrument:    res.Instrument,
	}, nil
}

func (p ledgerPort) SellInvestment(
	ctx context.Context,
	booksID int64,
	s app.InvestmentSale,
) (uuid.UUID, error) {
	price, err := p.l.FixedIncomeUnitPrice(ctx, booksID, s.Instrument, s.On)
	if err != nil {
		return uuid.Nil, p.refusal(err)
	}

	held, err := p.l.Balance(ctx, booksID, s.AccountID, s.On)
	if err != nil {
		return uuid.Nil, p.translate(err)
	}

	quantity, unit, err := saleQuantity(s.Amount, price, held)
	if err != nil {
		return uuid.Nil, err
	}

	o := ledger.TradeOrder{
		AccountID: s.AccountID,
		Side:      ledger.SideSell,
		Date:      s.On,
		Quantity:  quantity,
		UnitPrice: unit,
	}
	if s.Taxes.Amount() > 0 {
		o.Taxes = &s.Taxes
	}

	t, err := p.l.RecordTrade(ctx, booksID, o)
	if err != nil {
		return uuid.Nil, p.refusal(err)
	}

	return t.ID, nil
}

func (p ledgerPort) InvestmentIncome(
	ctx context.Context,
	booksID int64,
	i app.InvestmentIncome,
) (uuid.UUID, error) {
	none, err := money.New(0, i.Gross.Currency())
	if err != nil {
		return uuid.Nil, err
	}

	t, err := p.l.RecordIncome(ctx, booksID, ledger.IncomeOrder{
		AccountID:  i.AccountID,
		CategoryID: i.CategoryID,
		Type:       ledger.IncomeInterest,
		Date:       i.On,
		Gross:      i.Gross,
		Withheld:   &none,
	})
	if err != nil {
		return uuid.Nil, p.refusal(err)
	}

	return t.ID, nil
}

func (p ledgerPort) VoidInvestment(ctx context.Context, booksID int64, txID uuid.UUID) error {
	return p.translate(p.l.VoidTransaction(ctx, booksID, txID, undoReason))
}

func (p ledgerPort) HeldUnits(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	on time.Time,
) (money.Money, error) {
	held, err := p.l.Balance(ctx, booksID, accountID, on)

	return held, p.translate(err)
}

// refusal keeps the code and field of a refusal of a fixed income order.
func (p ledgerPort) refusal(err error) error {
	code := ""

	switch {
	case errors.Is(err, ledger.ErrContractInvalid):
		code = "contract_invalid"
	case errors.Is(err, ledger.ErrPriceMissing):
		code = "price_missing"
	case errors.Is(err, ledger.ErrBrokerageCashMissing):
		code = "brokerage_cash_missing"
	case errors.Is(err, ledger.ErrBrokerageCashAmbiguous):
		code = "brokerage_cash_ambiguous"
	default:
		if !hasField(err) {
			return p.translate(err)
		}

		code = "validation_failed"
	}

	r := &app.LedgerRefusal{Code: code, Message: err.Error()}
	if fe, ok := errors.AsType[*ledger.FieldError](err); ok {
		r.Field, r.Message = fe.Field, fe.Message
	}

	return r
}

func hasField(err error) bool {
	_, ok := errors.AsType[*ledger.FieldError](err)

	return ok
}

// saleQuantity is the units amount covers at price, half to even and capped at held, and the
// unit price that makes the order total amount (A236 FC28).
func saleQuantity(
	amount money.Money,
	price money.Rate,
	held money.Money,
) (money.Money, money.Rate, error) {
	zero := money.Money{}
	if price.Mantissa() <= 0 || held.Amount() <= 0 {
		return zero, money.Rate{}, &app.LedgerRefusal{
			Code: "price_missing", Field: "date", Message: "no price or no units on this date",
		}
	}

	num := new(big.Int).Mul(big.NewInt(amount.Amount()), pow10(price.Scale()+held.Scale()))
	den := new(big.Int).Mul(pow10(amount.Scale()), big.NewInt(price.Mantissa()))

	units := min(halfEven(num, den), held.Amount())
	if units <= 0 {
		return zero, money.Rate{}, &app.LedgerRefusal{
			Code: "validation_failed", Field: "amount", Message: "is too small for the unit price",
		}
	}

	num = new(big.Int).Mul(big.NewInt(amount.Amount()), pow10(held.Scale()+unitPriceScale))
	den = new(big.Int).Mul(pow10(amount.Scale()), big.NewInt(units))

	unit, err := money.NewRate(halfEven(num, den), unitPriceScale)
	if err != nil {
		return zero, money.Rate{}, err
	}

	quantity, err := money.NewOf(units, held.Currency(), held.Scale())

	return quantity, unit, err
}

func halfEven(num, den *big.Int) int64 {
	q, r := new(big.Int).QuoRem(num, den, new(big.Int))

	switch r.Lsh(r, 1).Cmp(den) {
	case 1:
		q.Add(q, big.NewInt(1))
	case 0:
		if q.Bit(0) == 1 {
			q.Add(q, big.NewInt(1))
		}
	}

	return q.Int64()
}

func pow10(n int) *big.Int { return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil) }

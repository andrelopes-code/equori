package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func (s investmentStep) income(
	ctx context.Context,
	pv tool.Preview,
) (tool.Preview, func() (recordInvestmentOut, error), error) {
	in := s.in

	gross, err := tool.ParsePositive("gross", in.Gross, s.target.cashUnit)
	if err != nil {
		return pv, nil, err
	}

	withheld, err := s.withheld(ctx, gross)
	if err != nil {
		return pv, nil, err
	}

	o := domain.IncomeOrder{
		AccountID:          s.ids.account,
		CashAccountID:      s.ids.cash,
		BrokerageID:        s.ids.brokerage,
		Instrument:         money.Currency(in.Instrument),
		CategoryID:         s.ids.category,
		Type:               domain.IncomeType(in.IncomeType),
		Date:               in.Date.Time,
		Gross:              gross,
		Withheld:           withheld,
		WithheldCategoryID: s.ids.withheldCategory,
		Description:        in.Description,
	}

	net, err := subtract(gross, withheld)
	if err != nil {
		return pv, nil, err
	}

	if o.ExchangeRate, err = parseExchangeRate(in.ExchangeRate); err != nil {
		return pv, nil, err
	}

	appendIncomeChanges(&pv, o, net)

	if err = s.appendIncomeRate(ctx, &pv, o); err != nil {
		return pv, nil, err
	}

	s.appendCashAndDate(&pv)
	s.fix.compareIncome(&pv)

	return pv, func() (recordInvestmentOut, error) {
		t, err := s.fix.income(s.svc)(ctx, s.booksID, o)
		return recordInvestmentOut{TransactionID: t.ID.String()}, err
	}, nil
}

func appendIncomeChanges(pv *tool.Preview, o domain.IncomeOrder, net money.Money) {
	appendMoneyChange(pv, "amount", &o.Gross)
	appendMoneyChange(pv, "withheld", o.Withheld)
	appendMoneyChange(pv, "net", &net)
	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "income_type", After: tool.TextValue(string(o.Type))},
	)
}

// appendIncomeRate states the rate and the base amount of an income: the gross less the tax
// withheld, each converted on its own.
func (s investmentStep) appendIncomeRate(
	ctx context.Context,
	pv *tool.Preview,
	o domain.IncomeOrder,
) error {
	rate := rateStep{s.svc, s.booksID, o.Date, o.ExchangeRate, s.in.ExchangeRate}

	return rate.appendChanges(
		ctx, pv, o.Gross.Currency(), []*money.Money{&o.Gross}, []*money.Money{o.Withheld},
	)
}

// withheld is the tax the proposal states and records: the one given, zero included, or the one
// the region's rate takes; nil when neither exists.
func (s investmentStep) withheld(ctx context.Context, gross money.Money) (*money.Money, error) {
	in := s.in

	if in.Withheld != "" {
		given, err := tool.ParseAmount("withheld", in.Withheld, s.target.cashUnit)
		if err != nil {
			return nil, err
		}

		if given.IsNegative() {
			return nil, tool.InvalidArgument("withheld", "must be zero or greater")
		}

		return &given, nil
	}

	estimate, err := s.svc.EstimateIncomeWithholding(
		ctx,
		s.booksID,
		domain.IncomeType(in.IncomeType),
		in.Date.Time,
		gross.Amount(),
	)
	if err != nil || estimate.RateBP == 0 {
		return nil, err
	}

	return &estimate.Withheld, nil
}

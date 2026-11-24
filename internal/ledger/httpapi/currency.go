package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) recordForeignPurchase(
	ctx context.Context,
	r *http.Request,
	in RecordForeignPurchaseJSONRequestBody,
) (Transaction, string, error) {
	b := in

	original, err := fromMoneyAPI("original", b.Original)
	if err != nil {
		return Transaction{}, "", err
	}

	rate, err := money.ParseRate(b.Rate)
	if err != nil {
		return Transaction{}, "", &domain.FieldError{
			Field:   "rate",
			Message: "must be a positive decimal with at most 12 decimals",
			Err:     domain.ErrValidation,
		}
	}

	input := app.ForeignPurchase{
		AccountID:               b.AccountId,
		CategoryID:              b.CategoryId,
		PayeeID:                 optUUID(b.PayeeId),
		ForeignChargeCategoryID: optUUID(b.ForeignChargeCategoryId),
		Date: dateOf(
			b.Date,
		),
		Description:         optString(b.Description),
		Original:            original,
		Rate:                rate,
		ForeignChargeRateBP: b.ForeignChargeRateBp,
	}
	if b.Statement != nil {
		m, err := domain.ParseReferenceMonth(*b.Statement)
		if err != nil {
			return Transaction{}, "", &domain.FieldError{
				Field:   "statement",
				Message: err.Error(),
				Err:     domain.ErrValidation,
			}
		}

		input.Statement = &m
	}

	t, err := s.svc.RecordForeignPurchase(ctx, auth.MustBooksID(ctx), input)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) exchangeCurrency(
	ctx context.Context,
	r *http.Request,
	in ExchangeCurrencyJSONRequestBody,
) (Transaction, string, error) {
	b := in

	from, err := fromMoneyAPI("from_amount", b.FromAmount)
	if err != nil {
		return Transaction{}, "", err
	}

	to, err := fromMoneyAPI("to_amount", b.ToAmount)
	if err != nil {
		return Transaction{}, "", err
	}

	input := app.Exchange{
		FromAccountID: b.FromAccountId,
		ToAccountID:   b.ToAccountId,
		FeeCategoryID: optUUID(b.FeeCategoryId),
		Date:          dateOf(b.Date),
		Description:   optString(b.Description),
		FromAmount:    from,
		ToAmount:      to,
	}
	if b.Fee != nil {
		fee, err := fromMoneyAPI("fee", *b.Fee)
		if err != nil {
			return Transaction{}, "", err
		}

		input.Fee = &fee
	}

	t, err := s.svc.Exchange(ctx, auth.MustBooksID(ctx), input)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) recordTrade(
	ctx context.Context,
	r *http.Request,
	in RecordTradeJSONRequestBody,
) (Transaction, string, error) {
	b := in

	o, err := s.tradeOrderFromInput(ctx, b)
	if err != nil {
		return Transaction{}, "", err
	}

	t, err := s.svc.RecordTrade(ctx, auth.MustBooksID(ctx), o)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) tradeOrderFromInput(
	ctx context.Context,
	b RecordTradeJSONRequestBody,
) (domain.TradeOrder, error) {
	code, err := s.svc.ResolveCode(ctx, money.Currency(b.Quantity.Currency))
	if err != nil {
		return domain.TradeOrder{}, err
	}

	instrument, err := s.svc.ResolveCode(ctx, money.Currency(optString(b.Instrument)))
	if err != nil {
		return domain.TradeOrder{}, err
	}

	quantity, err := s.svc.AmountOf(ctx, b.Quantity.Amount, code)
	if err != nil {
		return domain.TradeOrder{}, &domain.FieldError{
			Field:   "quantity",
			Message: err.Error(),
			Err:     domain.ErrValidation,
		}
	}

	price, err := tradePrice(b)
	if err != nil {
		return domain.TradeOrder{}, err
	}

	o := domain.TradeOrder{
		AccountID:       optUUID(b.AccountId),
		CashAccountID:   optUUID(b.CashAccountId),
		BrokerageID:     optUUID(b.BrokerageId),
		Instrument:      instrument,
		TaxesCategoryID: optUUID(b.TaxesCategoryId),
		Side:            domain.Side(b.Side),
		Date:            dateOf(b.Date),
		SettlementDate:  optDate(b.SettlementDate),
		Quantity:        quantity,
		UnitPrice:       price,
		Description:     optString(b.Description),
	}
	if err := setTradeCharges(&o, b); err != nil {
		return domain.TradeOrder{}, err
	}

	return o, nil
}

// tradePrice reads the unit price a purchase and a sale require; a write-off takes none.
func tradePrice(b RecordTradeJSONRequestBody) (money.Rate, error) {
	if b.UnitPrice == nil && b.Side == WriteOff {
		return money.Rate{}, nil
	}

	price, err := money.ParseRate(optString(b.UnitPrice))
	if err != nil {
		return money.Rate{}, &domain.FieldError{
			Field:   "unit_price",
			Message: "must be a positive decimal with at most 12 decimals",
			Err:     domain.ErrValidation,
		}
	}

	return price, nil
}

func setTradeCharges(o *domain.TradeOrder, b RecordTradeJSONRequestBody) error {
	if b.Fees != nil {
		fees, err := fromMoneyAPI("fees", *b.Fees)
		if err != nil {
			return err
		}

		o.Fees = &fees
	}

	if b.Taxes != nil {
		taxes, err := fromMoneyAPI("taxes", *b.Taxes)
		if err != nil {
			return err
		}

		o.Taxes = &taxes
	}

	return nil
}

func (s *Server) recordInvestmentIncome(
	ctx context.Context,
	r *http.Request,
	in RecordInvestmentIncomeJSONRequestBody,
) (Transaction, string, error) {
	o, err := s.incomeOrderFromInput(ctx, in)
	if err != nil {
		return Transaction{}, "", err
	}

	t, err := s.svc.RecordIncome(ctx, auth.MustBooksID(ctx), o)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) getIncomeWithholding(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (IncomeWithholding, error) {
	params, err := httpserver.Query[GetIncomeWithholdingParams](r)
	if err != nil {
		return IncomeWithholding{}, err
	}

	w, err := s.svc.EstimateIncomeWithholding(
		ctx,
		auth.MustBooksID(ctx),
		domain.IncomeType(params.IncomeType),
		dateOf(params.Date),
		params.Gross,
	)
	if err != nil {
		return IncomeWithholding{}, err
	}

	return IncomeWithholding{RateBp: w.RateBP, Withheld: toMoneyAPI(w.Withheld)}, nil
}

func (s *Server) incomeOrderFromInput(
	ctx context.Context,
	b InvestmentIncomeInput,
) (domain.IncomeOrder, error) {
	gross, err := fromMoneyAPI("gross", b.Gross)
	if err != nil {
		return domain.IncomeOrder{}, err
	}

	instrument, err := s.svc.ResolveCode(ctx, money.Currency(optString(b.Instrument)))
	if err != nil {
		return domain.IncomeOrder{}, err
	}

	o := domain.IncomeOrder{
		AccountID:          optUUID(b.AccountId),
		CashAccountID:      optUUID(b.CashAccountId),
		BrokerageID:        optUUID(b.BrokerageId),
		Instrument:         instrument,
		CategoryID:         b.CategoryId,
		WithheldCategoryID: optUUID(b.WithheldCategoryId),
		Type:               domain.IncomeType(b.IncomeType),
		Date:               dateOf(b.Date),
		Gross:              gross,
		Description:        optString(b.Description),
	}
	if b.Withheld != nil {
		withheld, err := fromMoneyAPI("withheld", *b.Withheld)
		if err != nil {
			return domain.IncomeOrder{}, err
		}

		o.Withheld = &withheld
	}

	return o, nil
}

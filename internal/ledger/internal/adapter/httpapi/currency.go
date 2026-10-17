package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) RecordForeignPurchase(ctx context.Context, req RecordForeignPurchaseRequestObject) (RecordForeignPurchaseResponseObject, error) {
	b := req.Body
	original, err := fromMoneyAPI("original", b.Original)
	if err != nil {
		return nil, err
	}
	rate, err := money.ParseRate(b.Rate)
	if err != nil {
		return nil, &domain.FieldError{Field: "rate", Message: "must be a positive decimal with at most 12 decimals", Err: domain.ErrValidation}
	}
	in := app.ForeignPurchase{
		AccountID: b.AccountId, CategoryID: b.CategoryId, PayeeID: optUUID(b.PayeeId), IOFCategoryID: optUUID(b.IofCategoryId),
		Date: dateOf(b.Date), Description: optString(b.Description), Original: original, Rate: rate, IOFRateBP: b.IofRateBp,
	}
	if b.Statement != nil {
		m, err := domain.ParseReferenceMonth(*b.Statement)
		if err != nil {
			return nil, &domain.FieldError{Field: "statement", Message: err.Error(), Err: domain.ErrValidation}
		}
		in.Statement = &m
	}
	t, err := s.svc.RecordForeignPurchase(ctx, auth.MustUserID(ctx), in)
	if err != nil {
		return nil, err
	}
	return RecordForeignPurchase201JSONResponse{Body: toTransactionAPI(t), Headers: RecordForeignPurchase201ResponseHeaders{Location: location("/transactions/", t.ID)}}, nil
}

func (s *Server) ExchangeCurrency(ctx context.Context, req ExchangeCurrencyRequestObject) (ExchangeCurrencyResponseObject, error) {
	b := req.Body
	from, err := fromMoneyAPI("from_amount", b.FromAmount)
	if err != nil {
		return nil, err
	}
	to, err := fromMoneyAPI("to_amount", b.ToAmount)
	if err != nil {
		return nil, err
	}
	in := app.Exchange{
		FromAccountID: b.FromAccountId, ToAccountID: b.ToAccountId, FeeCategoryID: optUUID(b.FeeCategoryId),
		Date: dateOf(b.Date), Description: optString(b.Description), FromAmount: from, ToAmount: to,
	}
	if b.Fee != nil {
		fee, err := fromMoneyAPI("fee", *b.Fee)
		if err != nil {
			return nil, err
		}
		in.Fee = &fee
	}
	t, err := s.svc.Exchange(ctx, auth.MustUserID(ctx), in)
	if err != nil {
		return nil, err
	}
	return ExchangeCurrency201JSONResponse{Body: toTransactionAPI(t), Headers: ExchangeCurrency201ResponseHeaders{Location: location("/transactions/", t.ID)}}, nil
}

func (s *Server) RecordTrade(ctx context.Context, req RecordTradeRequestObject) (RecordTradeResponseObject, error) {
	b := req.Body
	quantity, err := s.svc.AmountOf(ctx, b.Quantity.Amount, money.Currency(b.Quantity.Currency))
	if err != nil {
		return nil, &domain.FieldError{Field: "quantity", Message: err.Error(), Err: domain.ErrValidation}
	}
	price, err := money.ParseRate(b.UnitPrice)
	if err != nil {
		return nil, &domain.FieldError{Field: "unit_price", Message: "must be a positive decimal with at most 12 decimals", Err: domain.ErrValidation}
	}
	o := domain.TradeOrder{
		AccountID: b.AccountId, CashAccountID: b.CashAccountId, TaxesCategoryID: optUUID(b.TaxesCategoryId), Side: domain.Side(b.Side),
		Date: dateOf(b.Date), Quantity: quantity, UnitPrice: price, Description: optString(b.Description),
	}
	if b.Fees != nil {
		fees, err := fromMoneyAPI("fees", *b.Fees)
		if err != nil {
			return nil, err
		}
		o.Fees = &fees
	}
	if b.Taxes != nil {
		taxes, err := fromMoneyAPI("taxes", *b.Taxes)
		if err != nil {
			return nil, err
		}
		o.Taxes = &taxes
	}
	t, err := s.svc.RecordTrade(ctx, auth.MustUserID(ctx), o)
	if err != nil {
		return nil, err
	}
	return RecordTrade201JSONResponse{Body: toTransactionAPI(t), Headers: RecordTrade201ResponseHeaders{Location: location("/transactions/", t.ID)}}, nil
}

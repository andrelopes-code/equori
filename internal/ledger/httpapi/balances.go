package httpapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) getAccountBalance(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Balance, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Balance{}, err
	}

	params, err := httpserver.Query[GetAccountBalanceParams](r)
	if err != nil {
		return Balance{}, err
	}

	basis := app.BasisBooked
	if params.Basis != nil {
		basis = app.Basis(*params.Basis)
	}

	if params.ValueIn != nil {
		return s.valuedBalance(ctx, id, params, basis)
	}

	b, err := s.svc.BalanceAt(ctx, auth.MustBooksID(ctx), id, dateOf(params.Date), basis)
	if err != nil {
		return Balance{}, err
	}

	return Balance{
		AccountId: b.AccountID,
		Date:      apiDate(b.Date),
		Basis:     BalanceBasis(b.Basis),
		Balance:   toMoneyAPI(b.Amount),
	}, nil
}

func (s *Server) valuedBalance(
	ctx context.Context,
	id uuid.UUID,
	params GetAccountBalanceParams,
	basis app.Basis,
) (Balance, error) {
	b, c, err := s.svc.ValuedBalance(
		ctx,
		auth.MustBooksID(ctx),
		id,
		dateOf(params.Date),
		basis,
		money.Currency(*params.ValueIn),
	)
	if err != nil {
		return Balance{}, err
	}

	value, prices := toMoneyAPI(c.Value), make([]Price, len(c.Prices))
	for i, p := range c.Prices {
		prices[i] = Price{
			Instrument: string(
				p.Instrument,
			),
			QuoteInstrument: string(p.Quote),
			Date:            apiDate(p.Date),
			Value:           p.Value.Reduced().String(),
			Source:          p.Source,
			At:              p.At,
		}
		if p.At != nil {
			prices[i].Open = &p.Open
		}
	}

	return Balance{
		AccountId: b.AccountID,
		Date:      apiDate(b.Date),
		Basis:     BalanceBasis(b.Basis),
		Balance:   toMoneyAPI(b.Amount),
		Value:     &value,
		Prices:    &prices,
	}, nil
}

func (s *Server) listBalances(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BalanceList, error) {
	params, err := httpserver.Query[ListBalancesParams](r)
	if err != nil {
		return BalanceList{}, err
	}

	basis := app.BasisBooked
	if params.Basis != nil {
		basis = app.Basis(*params.Basis)
	}

	balances, err := s.svc.BalancesAt(ctx, auth.MustBooksID(ctx), dateOf(params.Date), basis)
	if err != nil {
		return BalanceList{}, err
	}

	out := BalanceList{Items: make([]Balance, len(balances))}
	for i, b := range balances {
		out.Items[i] = Balance{
			AccountId: b.AccountID,
			Date:      apiDate(b.Date),
			Basis:     BalanceBasis(b.Basis),
			Balance:   toMoneyAPI(b.Amount),
		}
	}

	return out, nil
}

func (s *Server) getAccountLots(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (AccountLots, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return AccountLots{}, err
	}

	params, err := httpserver.Query[GetAccountLotsParams](r)
	if err != nil {
		return AccountLots{}, err
	}

	var exclude uuid.UUID
	if params.ExcludeTransactionId != nil {
		exclude = *params.ExcludeTransactionId
	}

	h, err := s.svc.OpenLots(ctx, auth.MustBooksID(ctx), id, dateOf(params.Date), exclude)
	if err != nil {
		return AccountLots{}, err
	}

	lots := make([]OpenLot, len(h.Lots))
	for i, l := range h.Lots {
		lots[i] = OpenLot{
			AcquiredOn: apiDate(l.AcquiredOn),
			Quantity:   toMoneyAPI(l.Quantity),
			Cost:       toMoneyAPI(l.Cost),
		}
	}

	return AccountLots{
		AccountId:            id,
		Date:                 params.Date,
		Method:               AccountLotsMethod(h.Method),
		EstimatesWithholding: h.EstimatesWithholding,
		Quantity:             toMoneyAPI(h.Quantity),
		CostBasis:            toMoneyAPI(h.CostBasis),
		Lots:                 lots,
	}, nil
}

func (s *Server) getAccountWithholding(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (WithholdingEstimate, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return WithholdingEstimate{}, err
	}

	params, err := httpserver.Query[GetAccountWithholdingParams](r)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	w, err := s.svc.EstimateWithholding(
		ctx, auth.MustBooksID(ctx), id, dateOf(params.Date), params.Quantity, params.Proceeds,
	)
	if err != nil {
		return WithholdingEstimate{}, err
	}

	out := WithholdingEstimate{
		AccountId: id,
		Date:      params.Date,
		IncomeTax: toMoneyAPI(w.IncomeTax),
		Iof:       toMoneyAPI(w.IOF),
		Net:       toMoneyAPI(w.Net),
	}
	if w.CustodyFee != nil {
		fee := toMoneyAPI(*w.CustodyFee)
		out.CustodyFee = &fee
	}

	return out, nil
}

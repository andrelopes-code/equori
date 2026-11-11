package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) GetAccountBalance(ctx context.Context, req GetAccountBalanceRequestObject) (GetAccountBalanceResponseObject, error) {
	basis := app.BasisBooked
	if req.Params.Basis != nil {
		basis = app.Basis(*req.Params.Basis)
	}

	if req.Params.ValueIn != nil {
		b, c, err := s.svc.ValuedBalance(ctx, auth.MustBooksID(ctx), req.Id, dateOf(req.Params.Date), basis, money.Currency(*req.Params.ValueIn))
		if err != nil {
			return nil, err
		}

		value, prices := toMoneyAPI(c.Value), make([]Price, len(c.Prices))
		for i, p := range c.Prices {
			prices[i] = Price{
				Instrument: string(p.Instrument), QuoteInstrument: string(p.Quote), Date: apiDate(p.Date),
				Value: p.Value.Reduced().String(), Source: p.Source,
			}
		}

		return GetAccountBalance200JSONResponse{
			AccountId: b.AccountID, Date: apiDate(b.Date), Basis: BalanceBasis(b.Basis), Balance: toMoneyAPI(b.Amount),
			Value: &value, Prices: &prices,
		}, nil
	}

	b, err := s.svc.BalanceAt(ctx, auth.MustBooksID(ctx), req.Id, dateOf(req.Params.Date), basis)
	if err != nil {
		return nil, err
	}

	return GetAccountBalance200JSONResponse{
		AccountId: b.AccountID, Date: apiDate(b.Date), Basis: BalanceBasis(b.Basis), Balance: toMoneyAPI(b.Amount),
	}, nil
}

func (s *Server) ListBalances(ctx context.Context, req ListBalancesRequestObject) (ListBalancesResponseObject, error) {
	basis := app.BasisBooked
	if req.Params.Basis != nil {
		basis = app.Basis(*req.Params.Basis)
	}

	balances, err := s.svc.BalancesAt(ctx, auth.MustBooksID(ctx), dateOf(req.Params.Date), basis)
	if err != nil {
		return nil, err
	}

	out := ListBalances200JSONResponse{Items: make([]Balance, len(balances))}
	for i, b := range balances {
		out.Items[i] = Balance{AccountId: b.AccountID, Date: apiDate(b.Date), Basis: BalanceBasis(b.Basis), Balance: toMoneyAPI(b.Amount)}
	}

	return out, nil
}

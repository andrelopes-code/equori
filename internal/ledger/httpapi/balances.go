package httpapi

import (
	"context"
	"net/http"

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

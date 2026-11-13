package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) correctTrade(
	ctx context.Context,
	r *http.Request,
	in CorrectTradeJSONRequestBody,
) (Transaction, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, err
	}

	o, err := s.tradeOrderFromInput(ctx, in.Trade)
	if err != nil {
		return Transaction{}, err
	}

	t, err := s.svc.CorrectTrade(
		ctx,
		auth.MustBooksID(ctx),
		id,
		in.ExpectedVersion,
		o,
		in.Reason,
	)
	if err != nil {
		return Transaction{}, err
	}

	return toTransactionAPI(t), nil
}

func (s *Server) correctInvestmentIncome(
	ctx context.Context,
	r *http.Request,
	in CorrectInvestmentIncomeJSONRequestBody,
) (Transaction, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, err
	}

	o, err := incomeOrderFromInput(in.Income)
	if err != nil {
		return Transaction{}, err
	}

	t, err := s.svc.CorrectIncome(
		ctx,
		auth.MustBooksID(ctx),
		id,
		in.ExpectedVersion,
		o,
		in.Reason,
	)
	if err != nil {
		return Transaction{}, err
	}

	return toTransactionAPI(t), nil
}

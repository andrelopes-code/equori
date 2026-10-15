package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func toAssertionAPI(a app.BalanceAssertion, currency money.Currency) BalanceAssertion {
	return BalanceAssertion{
		Id: a.ID, AccountId: a.AccountID, Date: apiDate(a.Date), Source: BalanceAssertionSource(a.Source),
		Amount: Money{Amount: a.Amount, Currency: string(currency)}, RecordedAt: a.RecordedAt,
	}
}

func (s *Server) CreateBalanceAssertion(ctx context.Context, req CreateBalanceAssertionRequestObject) (CreateBalanceAssertionResponseObject, error) {
	amount, err := fromMoneyAPI("amount", req.Body.Amount)
	if err != nil {
		return nil, err
	}
	res, err := s.svc.AssertBalance(ctx, auth.MustUserID(ctx), req.Id, dateOf(req.Body.Date), amount, optString((*string)(req.Body.Source)))
	if err != nil {
		return nil, err
	}
	out := AssertionResult{
		Assertion:  toAssertionAPI(res.Assertion, amount.Currency()),
		Difference: toMoneyAPI(res.Difference), YieldTransactionId: apiOptUUID(res.YieldTransactionID),
	}
	if res.Resolution != "" {
		r := AssertionResultResolution(res.Resolution)
		out.Resolution = &r
	}
	return CreateBalanceAssertion201JSONResponse(out), nil
}

func (s *Server) ListBalanceAssertions(ctx context.Context, req ListBalanceAssertionsRequestObject) (ListBalanceAssertionsResponseObject, error) {
	userID := auth.MustUserID(ctx)
	a, err := s.svc.Account(ctx, userID, req.Id)
	if err != nil {
		return nil, err
	}
	assertions, err := s.svc.BalanceAssertions(ctx, userID, req.Id)
	if err != nil {
		return nil, err
	}
	out := BalanceAssertionList{Items: make([]BalanceAssertion, len(assertions))}
	for i, x := range assertions {
		out.Items[i] = toAssertionAPI(x, a.Instrument)
	}
	return ListBalanceAssertions200JSONResponse(out), nil
}

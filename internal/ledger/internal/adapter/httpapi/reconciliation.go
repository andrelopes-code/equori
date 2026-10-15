package httpapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func toAssertionAPI(a app.BalanceAssertion, currency money.Currency) BalanceAssertion {
	return BalanceAssertion{
		Id: a.ID, AccountId: a.AccountID, Date: apiDate(a.Date), Source: BalanceAssertionSource(a.Source),
		Amount: Money{Amount: a.Amount, Currency: string(currency)}, RecordedAt: a.RecordedAt, Reconciled: a.Reconciled,
	}
}

func toAssertionResultAPI(res app.AssertionResult) AssertionResult {
	out := AssertionResult{
		Assertion:  toAssertionAPI(res.Assertion, res.Difference.Currency()),
		Difference: toMoneyAPI(res.Difference), ResolutionTransactionId: apiOptUUID(res.ResolutionTransactionID),
	}
	if res.Resolution != "" {
		r := AssertionResultResolution(res.Resolution)
		out.Resolution = &r
	}
	return out
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
	return CreateBalanceAssertion201JSONResponse(toAssertionResultAPI(res)), nil
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

func (s *Server) ResolveBalanceAssertion(ctx context.Context, req ResolveBalanceAssertionRequestObject) (ResolveBalanceAssertionResponseObject, error) {
	res, err := s.svc.ResolveAssertion(ctx, auth.MustUserID(ctx), req.Id, domain.Resolution(req.Body.Resolution))
	if err != nil {
		return nil, err
	}
	return ResolveBalanceAssertion200JSONResponse(toAssertionResultAPI(res)), nil
}

func (s *Server) GetReconciliationStatus(ctx context.Context, req GetReconciliationStatusRequestObject) (GetReconciliationStatusResponseObject, error) {
	out, err := s.reconciliationStatus(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetReconciliationStatus200JSONResponse(out), nil
}

func (s *Server) reconciliationStatus(ctx context.Context, userID int64, accountID uuid.UUID) (ReconciliationStatus, error) {
	st, err := s.svc.ReconciliationStatus(ctx, userID, accountID)
	if err != nil {
		return ReconciliationStatus{}, err
	}
	out := ReconciliationStatus{LastReconciledOn: apiOptDate(st.LastReconciledOn)}
	if st.Open != nil {
		out.OpenDifference = &OpenDifference{AssertionId: st.Open.AssertionID, Date: apiDate(st.Open.Date), Difference: toMoneyAPI(st.Open.Difference)}
	}
	return out, nil
}

func (s *Server) UnlockAccount(ctx context.Context, req UnlockAccountRequestObject) (UnlockAccountResponseObject, error) {
	userID := auth.MustUserID(ctx)
	if err := s.svc.Unlock(ctx, userID, req.Id, dateOf(req.Body.From)); err != nil {
		return nil, err
	}
	out, err := s.reconciliationStatus(ctx, userID, req.Id)
	if err != nil {
		return nil, err
	}
	return UnlockAccount200JSONResponse(out), nil
}

func (s *Server) ReconcileStatement(ctx context.Context, req ReconcileStatementRequestObject) (ReconcileStatementResponseObject, error) {
	amount, err := fromMoneyAPI("amount_due", req.Body.AmountDue)
	if err != nil {
		return nil, err
	}
	userID := auth.MustUserID(ctx)
	if err := s.svc.ReconcileStatement(ctx, userID, req.Id, amount); err != nil {
		return nil, err
	}
	out, err := s.statementDetail(ctx, userID, req.Id)
	if err != nil {
		return nil, err
	}
	return ReconcileStatement200JSONResponse(out), nil
}

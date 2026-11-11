package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
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

func (s *Server) createBalanceAssertion(
	ctx context.Context,
	r *http.Request,
	in CreateBalanceAssertionJSONRequestBody,
) (AssertionResult, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return AssertionResult{}, err
	}

	amount, err := fromMoneyAPI("amount", in.Amount)
	if err != nil {
		return AssertionResult{}, err
	}

	res, err := s.svc.AssertBalance(ctx, auth.MustBooksID(ctx), id, dateOf(in.Date), amount, optString((*string)(in.Source)))
	if err != nil {
		return AssertionResult{}, err
	}

	return toAssertionResultAPI(res), nil
}

func (s *Server) listBalanceAssertions(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BalanceAssertionList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return BalanceAssertionList{}, err
	}

	params, err := httpserver.Query[ListBalanceAssertionsParams](r)
	if err != nil {
		return BalanceAssertionList{}, err
	}

	booksID := auth.MustBooksID(ctx)

	a, err := s.svc.Account(ctx, booksID, id)
	if err != nil {
		return BalanceAssertionList{}, err
	}

	p, err := listPage[app.AssertionKey](params.Limit, params.Cursor)
	if err != nil {
		return BalanceAssertionList{}, err
	}

	assertions, next, err := s.svc.BalanceAssertions(ctx, booksID, id, p)
	if err != nil {
		return BalanceAssertionList{}, err
	}

	out := BalanceAssertionList{Items: make([]BalanceAssertion, len(assertions))}
	for i, x := range assertions {
		out.Items[i] = toAssertionAPI(x, a.Instrument)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) resolveBalanceAssertion(
	ctx context.Context,
	r *http.Request,
	in ResolveBalanceAssertionJSONRequestBody,
) (AssertionResult, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return AssertionResult{}, err
	}

	res, err := s.svc.ResolveAssertion(ctx, auth.MustBooksID(ctx), id, domain.Resolution(in.Resolution))
	if err != nil {
		return AssertionResult{}, err
	}

	return toAssertionResultAPI(res), nil
}

func (s *Server) getReconciliationStatus(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (ReconciliationStatus, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ReconciliationStatus{}, err
	}

	out, err := s.reconciliationStatus(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return ReconciliationStatus{}, err
	}

	return out, nil
}

func (s *Server) reconciliationStatus(ctx context.Context, booksID int64, accountID uuid.UUID) (ReconciliationStatus, error) {
	st, err := s.svc.ReconciliationStatus(ctx, booksID, accountID)
	if err != nil {
		return ReconciliationStatus{}, err
	}

	out := ReconciliationStatus{LastReconciledOn: apiOptDate(st.LastReconciledOn)}
	if st.Open != nil {
		out.OpenDifference = &OpenDifference{AssertionId: st.Open.AssertionID, Date: apiDate(st.Open.Date), Difference: toMoneyAPI(st.Open.Difference)}
	}

	return out, nil
}

func (s *Server) unlockAccount(
	ctx context.Context,
	r *http.Request,
	in UnlockAccountJSONRequestBody,
) (ReconciliationStatus, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ReconciliationStatus{}, err
	}

	booksID := auth.MustBooksID(ctx)
	if err := s.svc.Unlock(ctx, booksID, id, dateOf(in.From)); err != nil {
		return ReconciliationStatus{}, err
	}

	out, err := s.reconciliationStatus(ctx, booksID, id)
	if err != nil {
		return ReconciliationStatus{}, err
	}

	return out, nil
}

func (s *Server) reconcileStatement(
	ctx context.Context,
	r *http.Request,
	in ReconcileStatementJSONRequestBody,
) (StatementDetail, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return StatementDetail{}, err
	}

	amount, err := fromMoneyAPI("amount_due", in.AmountDue)
	if err != nil {
		return StatementDetail{}, err
	}

	booksID := auth.MustBooksID(ctx)
	if err := s.svc.ReconcileStatement(ctx, booksID, id, amount); err != nil {
		return StatementDetail{}, err
	}

	out, err := s.statementDetail(ctx, booksID, id)
	if err != nil {
		return StatementDetail{}, err
	}

	return out, nil
}

func (s *Server) deferStatementPostings(
	ctx context.Context,
	r *http.Request,
	in DeferStatementPostingsJSONRequestBody,
) (StatementDetail, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return StatementDetail{}, err
	}

	booksID := auth.MustBooksID(ctx)
	if err := s.svc.DeferPostings(ctx, booksID, id, in.TransactionIds); err != nil {
		return StatementDetail{}, err
	}

	out, err := s.statementDetail(ctx, booksID, id)
	if err != nil {
		return StatementDetail{}, err
	}

	return out, nil
}

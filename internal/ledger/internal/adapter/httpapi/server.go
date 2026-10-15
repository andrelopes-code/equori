package httpapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const BaseURL = "/api/v1"

var _ StrictServerInterface = (*Server)(nil)

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: toProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.errs.WriteRequestError,
		ResponseErrorHandlerFunc: s.errs.Write,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{
		BaseURL:          BaseURL,
		BaseRouter:       mux,
		ErrorHandlerFunc: s.errs.WriteRequestError,
	})
}

func (s *Server) GetSettings(ctx context.Context, _ GetSettingsRequestObject) (GetSettingsResponseObject, error) {
	st, err := s.svc.Settings(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	return GetSettings200JSONResponse{BaseCurrency: string(st.BaseCurrency)}, nil
}

func (s *Server) UpdateSettings(ctx context.Context, req UpdateSettingsRequestObject) (UpdateSettingsResponseObject, error) {
	if err := s.svc.SetBaseCurrency(ctx, auth.MustUserID(ctx), money.Currency(req.Body.BaseCurrency)); err != nil {
		return nil, err
	}
	return UpdateSettings200JSONResponse(*req.Body), nil
}

func (s *Server) ListInstitutions(ctx context.Context, req ListInstitutionsRequestObject) (ListInstitutionsResponseObject, error) {
	p, err := listPage[app.InstitutionKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	rows, next, err := s.svc.ListInstitutions(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListInstitutions200JSONResponse{Items: make([]Institution, len(rows))}
	for i, r := range rows {
		out.Items[i] = toInstitutionAPI(r)
	}
	out.NextCursor, err = nextCursor(next)
	return out, err
}

func (s *Server) CreateInstitution(ctx context.Context, req CreateInstitutionRequestObject) (CreateInstitutionResponseObject, error) {
	i, err := s.svc.CreateInstitution(ctx, auth.MustUserID(ctx), req.Body.Name, optString(req.Body.Code))
	if err != nil {
		return nil, err
	}
	return CreateInstitution201JSONResponse(toInstitutionAPI(i)), nil
}

func (s *Server) ListPayees(ctx context.Context, req ListPayeesRequestObject) (ListPayeesResponseObject, error) {
	p, err := listPage[app.PayeeKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	rows, next, err := s.svc.ListPayees(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListPayees200JSONResponse{Items: make([]Payee, len(rows))}
	for i, r := range rows {
		out.Items[i] = toPayeeAPI(r)
	}
	out.NextCursor, err = nextCursor(next)
	return out, err
}

func (s *Server) CreatePayee(ctx context.Context, req CreatePayeeRequestObject) (CreatePayeeResponseObject, error) {
	p, err := s.svc.CreatePayee(ctx, auth.MustUserID(ctx), req.Body.Name)
	if err != nil {
		return nil, err
	}
	return CreatePayee201JSONResponse(toPayeeAPI(p)), nil
}

func (s *Server) ListTags(ctx context.Context, req ListTagsRequestObject) (ListTagsResponseObject, error) {
	p, err := listPage[app.TagKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	tags, next, err := s.svc.ListTags(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListTags200JSONResponse{Items: append([]string{}, tags...)}
	out.NextCursor, err = nextCursor(next)
	return out, err
}

func (s *Server) ListAccounts(ctx context.Context, req ListAccountsRequestObject) (ListAccountsResponseObject, error) {
	p, err := listPage[app.AccountKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	rows, next, err := s.svc.ListAccounts(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListAccounts200JSONResponse{Items: make([]Account, len(rows))}
	for i, r := range rows {
		out.Items[i] = toAccountAPI(r)
	}
	out.NextCursor, err = nextCursor(next)
	return out, err
}

func (s *Server) CreateAccount(ctx context.Context, req CreateAccountRequestObject) (CreateAccountResponseObject, error) {
	a, err := s.svc.CreateAccount(ctx, auth.MustUserID(ctx), fromAccountInput(*req.Body))
	if err != nil {
		return nil, err
	}
	return CreateAccount201JSONResponse{Body: toAccountAPI(a), Headers: CreateAccount201ResponseHeaders{Location: location("/accounts/", a.ID)}}, nil
}

func (s *Server) GetAccount(ctx context.Context, req GetAccountRequestObject) (GetAccountResponseObject, error) {
	userID := auth.MustUserID(ctx)
	a, err := s.svc.Account(ctx, userID, req.Id)
	if err != nil {
		return nil, err
	}
	out := toAccountAPI(a)
	summary, err := s.svc.CardSummary(ctx, userID, a)
	if err != nil {
		return nil, err
	}
	if summary != nil {
		limit, available := toMoneyAPI(summary.CreditLimit), toMoneyAPI(summary.AvailableLimit)
		out.Card = &CardSummary{CreditLimit: &limit, AvailableLimit: &available}
	}
	return GetAccount200JSONResponse(out), nil
}

func (s *Server) UpdateAccount(ctx context.Context, req UpdateAccountRequestObject) (UpdateAccountResponseObject, error) {
	patch := app.AccountPatch{Name: req.Body.Name, ParentID: req.Body.ParentId, InstitutionID: req.Body.InstitutionId}
	if req.Body.YieldMode != nil {
		mode := domain.YieldMode(*req.Body.YieldMode)
		patch.YieldMode = &mode
	}
	a, err := s.svc.UpdateAccount(ctx, auth.MustUserID(ctx), req.Id, patch)
	if err != nil {
		return nil, err
	}
	return UpdateAccount200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) CloseAccount(ctx context.Context, req CloseAccountRequestObject) (CloseAccountResponseObject, error) {
	userID := auth.MustUserID(ctx)
	if err := s.svc.CloseAccount(ctx, userID, req.Id, dateOf(req.Body.ClosedOn)); err != nil {
		return nil, err
	}
	a, err := s.svc.Account(ctx, userID, req.Id)
	if err != nil {
		return nil, err
	}
	return CloseAccount200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) GetAccountBalance(ctx context.Context, req GetAccountBalanceRequestObject) (GetAccountBalanceResponseObject, error) {
	basis := app.BasisBooked
	if req.Params.Basis != nil {
		basis = app.Basis(*req.Params.Basis)
	}
	b, err := s.svc.BalanceAt(ctx, auth.MustUserID(ctx), req.Id, dateOf(req.Params.Date), basis)
	if err != nil {
		return nil, err
	}
	return GetAccountBalance200JSONResponse{
		AccountId: b.AccountID, Date: apiDate(b.Date), Basis: BalanceBasis(b.Basis), Balance: toMoneyAPI(b.Amount),
	}, nil
}

func (s *Server) ListTransactions(ctx context.Context, req ListTransactionsRequestObject) (ListTransactionsResponseObject, error) {
	p, err := listPage[app.TransactionCursor](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	q := app.TransactionQuery{
		UserID: auth.MustUserID(ctx), AccountID: optUUID(req.Params.AccountId), PayeeID: optUUID(req.Params.PayeeId),
		Tag: optString(req.Params.Tag), From: optDate(req.Params.From), To: optDate(req.Params.To), Limit: p.Limit, After: p.After,
	}
	rows, next, err := s.svc.ListTransactions(ctx, q)
	if err != nil {
		return nil, err
	}
	out := ListTransactions200JSONResponse{Items: make([]Transaction, len(rows))}
	for i, t := range rows {
		out.Items[i] = toTransactionAPI(t)
	}
	out.NextCursor, err = nextCursor(next)
	return out, err
}

func (s *Server) CreateTransaction(ctx context.Context, req CreateTransactionRequestObject) (CreateTransactionResponseObject, error) {
	in, err := fromTransactionInput(*req.Body)
	if err != nil {
		return nil, err
	}
	t, err := s.svc.RecordTransaction(ctx, auth.MustUserID(ctx), in)
	if err != nil {
		return nil, err
	}
	return CreateTransaction201JSONResponse{Body: toTransactionAPI(t), Headers: CreateTransaction201ResponseHeaders{Location: location("/transactions/", t.ID)}}, nil
}

func (s *Server) GetTransaction(ctx context.Context, req GetTransactionRequestObject) (GetTransactionResponseObject, error) {
	t, err := s.svc.Transaction(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetTransaction200JSONResponse(toTransactionAPI(t)), nil
}

func (s *Server) CorrectTransaction(ctx context.Context, req CorrectTransactionRequestObject) (CorrectTransactionResponseObject, error) {
	b := req.Body
	in, err := fromTransactionInput(TransactionInput{
		Date: b.Date, Description: b.Description, PayeeId: b.PayeeId, Tags: b.Tags, Links: b.Links, Postings: b.Postings,
	})
	if err != nil {
		return nil, err
	}
	t, err := s.svc.CorrectTransaction(ctx, auth.MustUserID(ctx), req.Id, b.ExpectedVersion, in, b.Reason)
	if err != nil {
		return nil, err
	}
	return CorrectTransaction200JSONResponse(toTransactionAPI(t)), nil
}

func (s *Server) VoidTransaction(ctx context.Context, req VoidTransactionRequestObject) (VoidTransactionResponseObject, error) {
	userID := auth.MustUserID(ctx)
	if err := s.svc.VoidTransaction(ctx, userID, req.Id, req.Body.Reason); err != nil {
		return nil, err
	}
	t, err := s.svc.Transaction(ctx, userID, req.Id)
	if err != nil {
		return nil, err
	}
	return VoidTransaction200JSONResponse(toTransactionAPI(t)), nil
}

func (s *Server) ListTransactionVersions(ctx context.Context, req ListTransactionVersionsRequestObject) (ListTransactionVersionsResponseObject, error) {
	versions, err := s.svc.Versions(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	out := ListTransactionVersions200JSONResponse{Items: make([]TransactionVersion, len(versions))}
	for i, v := range versions {
		out.Items[i] = TransactionVersion{
			Version: v.Version, Reason: v.Reason, ReplacedAt: v.ReplacedAt, Transaction: toTransactionAPI(v.Transaction),
		}
	}
	return out, nil
}

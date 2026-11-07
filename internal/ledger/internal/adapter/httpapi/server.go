package httpapi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/page"

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
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
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
	st, err := s.svc.Settings(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return nil, err
	}

	return GetSettings200JSONResponse{BaseCurrency: string(st.BaseCurrency)}, nil
}

func (s *Server) UpdateSettings(ctx context.Context, req UpdateSettingsRequestObject) (UpdateSettingsResponseObject, error) {
	if err := s.svc.SetBaseCurrency(ctx, auth.MustBooksID(ctx), money.Currency(req.Body.BaseCurrency)); err != nil {
		return nil, err
	}

	return UpdateSettings200JSONResponse(*req.Body), nil
}

func (s *Server) ListInstitutions(ctx context.Context, req ListInstitutionsRequestObject) (ListInstitutionsResponseObject, error) {
	p, err := listPage[app.InstitutionKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}

	rows, next, err := s.svc.ListInstitutions(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return nil, err
	}

	out := ListInstitutions200JSONResponse{Items: make([]Institution, len(rows))}
	for i, r := range rows {
		out.Items[i] = toInstitutionAPI(r)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) CreateInstitution(ctx context.Context, req CreateInstitutionRequestObject) (CreateInstitutionResponseObject, error) {
	i, err := s.svc.CreateInstitution(ctx, auth.MustBooksID(ctx), app.Institution{Name: req.Body.Name, Code: optString(req.Body.Code), Identifier: institutionIdentifier(req.Body.Identifier)})
	if err != nil {
		return nil, err
	}

	return CreateInstitution201JSONResponse(toInstitutionAPI(i)), nil
}

func (s *Server) SetInstitutionIdentifier(ctx context.Context, req SetInstitutionIdentifierRequestObject) (SetInstitutionIdentifierResponseObject, error) {
	ident := app.InstitutionIdentifier{Scheme: optString(req.Body.Scheme), Value: optString(req.Body.Identifier)}
	if (ident.Scheme == "") != (ident.Value == "") {
		field := "identifier"
		if ident.Scheme == "" {
			field = "scheme"
		}

		return nil, &domain.FieldError{Field: field, Message: "must be set together with the other identifier field", Err: domain.ErrValidation}
	}

	i, err := s.svc.SetInstitutionIdentifier(ctx, auth.MustBooksID(ctx), req.Id, ident)
	if err != nil {
		return nil, err
	}

	return SetInstitutionIdentifier200JSONResponse(toInstitutionAPI(i)), nil
}

func (s *Server) DeleteInstitution(ctx context.Context, req DeleteInstitutionRequestObject) (DeleteInstitutionResponseObject, error) {
	if err := s.svc.DeleteInstitution(ctx, auth.MustBooksID(ctx), req.Id); err != nil {
		return nil, err
	}

	return DeleteInstitution204Response{}, nil
}

func (s *Server) ListInstitutionIdentifierSchemes(context.Context, ListInstitutionIdentifierSchemesRequestObject) (ListInstitutionIdentifierSchemesResponseObject, error) {
	schemes := s.svc.InstitutionIdentifierSchemes()

	out := ListInstitutionIdentifierSchemes200JSONResponse{Items: make([]InstitutionIdentifierScheme, len(schemes))}
	for i, sc := range schemes {
		out.Items[i] = InstitutionIdentifierScheme{Id: sc.ID, Pattern: sc.Pattern.String()}
	}

	return out, nil
}

func institutionIdentifier(i *InstitutionIdentifier) app.InstitutionIdentifier {
	if i == nil {
		return app.InstitutionIdentifier{}
	}

	return app.InstitutionIdentifier{Scheme: i.Scheme, Value: i.Identifier}
}

func (s *Server) ListPayees(ctx context.Context, req ListPayeesRequestObject) (ListPayeesResponseObject, error) {
	p, err := listPage[app.PayeeKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}

	rows, next, err := s.svc.ListPayees(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return nil, err
	}

	out := ListPayees200JSONResponse{Items: make([]Payee, len(rows))}
	for i, r := range rows {
		out.Items[i] = toPayeeAPI(r)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) CreatePayee(ctx context.Context, req CreatePayeeRequestObject) (CreatePayeeResponseObject, error) {
	p, err := s.svc.CreatePayee(ctx, auth.MustBooksID(ctx), req.Body.Name)
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

	tags, next, err := s.svc.ListTags(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return nil, err
	}

	out := ListTags200JSONResponse{Items: append([]string{}, tags...)}
	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) ListAccounts(ctx context.Context, req ListAccountsRequestObject) (ListAccountsResponseObject, error) {
	p, err := listPage[app.AccountKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}

	booksID := auth.MustBooksID(ctx)

	rows, next, err := s.svc.ListAccounts(ctx, booksID, p)
	if err != nil {
		return nil, err
	}

	out := ListAccounts200JSONResponse{Items: make([]Account, len(rows))}
	for i, r := range rows {
		if out.Items[i], err = s.accountAPI(ctx, booksID, r); err != nil {
			return nil, err
		}
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) CreateAccount(ctx context.Context, req CreateAccountRequestObject) (CreateAccountResponseObject, error) {
	a, err := s.svc.CreateAccount(ctx, auth.MustBooksID(ctx), fromAccountInput(*req.Body))
	if err != nil {
		return nil, err
	}

	return CreateAccount201JSONResponse{Body: toAccountAPI(a), Headers: CreateAccount201ResponseHeaders{Location: location("/accounts/", a.ID)}}, nil
}

func (s *Server) GetAccount(ctx context.Context, req GetAccountRequestObject) (GetAccountResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	a, err := s.svc.Account(ctx, booksID, req.Id)
	if err != nil {
		return nil, err
	}

	out, err := s.accountAPI(ctx, booksID, a)
	if err != nil {
		return nil, err
	}

	return GetAccount200JSONResponse(out), nil
}

// accountAPI is an account with the limits of a card, when it is one with a credit limit.
func (s *Server) accountAPI(ctx context.Context, booksID int64, a domain.Account) (Account, error) {
	out := toAccountAPI(a)

	summary, err := s.svc.CardSummary(ctx, booksID, a)
	if err != nil {
		return Account{}, err
	}

	if summary != nil {
		limit, available := toMoneyAPI(summary.CreditLimit), toMoneyAPI(summary.AvailableLimit)
		out.Card = &CardSummary{CreditLimit: &limit, AvailableLimit: &available}
	}

	return out, nil
}

func (s *Server) UpdateAccount(ctx context.Context, req UpdateAccountRequestObject) (UpdateAccountResponseObject, error) {
	patch := app.AccountPatch{
		Name: req.Body.Name, ParentID: req.Body.ParentId, InstitutionID: req.Body.InstitutionId,
		ExcludedFromLiquidity: req.Body.ExcludedFromLiquidity,
	}
	if req.Body.OpenedOn != nil {
		patch.OpenedOn = &req.Body.OpenedOn.Time
	}

	if req.Body.YieldMode != nil {
		mode := domain.YieldMode(*req.Body.YieldMode)
		patch.YieldMode = &mode
	}

	a, err := s.svc.UpdateAccount(ctx, auth.MustBooksID(ctx), req.Id, patch)
	if err != nil {
		return nil, err
	}

	return UpdateAccount200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) CloseAccount(ctx context.Context, req CloseAccountRequestObject) (CloseAccountResponseObject, error) {
	booksID := auth.MustBooksID(ctx)
	if err := s.svc.CloseAccount(ctx, booksID, req.Id, dateOf(req.Body.ClosedOn)); err != nil {
		return nil, err
	}

	a, err := s.svc.Account(ctx, booksID, req.Id)
	if err != nil {
		return nil, err
	}

	return CloseAccount200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) SetAccountAppearance(ctx context.Context, req SetAccountAppearanceRequestObject) (SetAccountAppearanceResponseObject, error) {
	var color int
	var icon string

	if req.Body.Color != nil {
		color = *req.Body.Color
	}

	if req.Body.Icon != nil {
		icon = string(*req.Body.Icon)
	}

	a, err := s.svc.SetAppearance(ctx, auth.MustBooksID(ctx), req.Id, color, icon)
	if err != nil {
		return nil, err
	}

	return SetAccountAppearance200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) SetAccountParent(ctx context.Context, req SetAccountParentRequestObject) (SetAccountParentResponseObject, error) {
	var parent uuid.UUID
	if req.Body.ParentId != nil {
		parent = *req.Body.ParentId
	}

	a, err := s.svc.UpdateAccount(ctx, auth.MustBooksID(ctx), req.Id, app.AccountPatch{ParentID: &parent})
	if err != nil {
		return nil, err
	}

	return SetAccountParent200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) RenamePayee(ctx context.Context, req RenamePayeeRequestObject) (RenamePayeeResponseObject, error) {
	p, err := s.svc.RenamePayee(ctx, auth.MustBooksID(ctx), req.Id, req.Body.Name)
	if err != nil {
		return nil, err
	}

	return RenamePayee200JSONResponse{Id: p.ID, Name: p.Name}, nil
}

func (s *Server) MergePayee(ctx context.Context, req MergePayeeRequestObject) (MergePayeeResponseObject, error) {
	p, err := s.svc.MergePayees(ctx, auth.MustBooksID(ctx), req.Id, req.Body.Into)
	if err != nil {
		return nil, err
	}

	return MergePayee200JSONResponse{Id: p.ID, Name: p.Name}, nil
}

func (s *Server) GetTag(ctx context.Context, req GetTagRequestObject) (GetTagResponseObject, error) {
	t, err := s.svc.Tag(ctx, auth.MustBooksID(ctx), req.Name)
	if err != nil {
		return nil, err
	}

	return GetTag200JSONResponse(toTagUsageAPI(t)), nil
}

func (s *Server) RenameTag(ctx context.Context, req RenameTagRequestObject) (RenameTagResponseObject, error) {
	t, err := s.svc.RenameTag(ctx, auth.MustBooksID(ctx), req.Name, req.Body.Name)
	if err != nil {
		return nil, err
	}

	return RenameTag200JSONResponse(toTagUsageAPI(t)), nil
}

func (s *Server) MergeTag(ctx context.Context, req MergeTagRequestObject) (MergeTagResponseObject, error) {
	t, err := s.svc.MergeTag(ctx, auth.MustBooksID(ctx), req.Name, req.Body.Into)
	if err != nil {
		return nil, err
	}

	return MergeTag200JSONResponse(toTagUsageAPI(t)), nil
}

func (s *Server) DeleteTag(ctx context.Context, req DeleteTagRequestObject) (DeleteTagResponseObject, error) {
	if err := s.svc.DeleteTag(ctx, auth.MustBooksID(ctx), req.Name); err != nil {
		return nil, err
	}

	return DeleteTag204Response{}, nil
}

func toTagUsageAPI(t app.TagUsage) TagUsage {
	return TagUsage{Name: t.Name, Transactions: t.Transactions}
}

func (s *Server) MergeAccount(ctx context.Context, req MergeAccountRequestObject) (MergeAccountResponseObject, error) {
	a, err := s.svc.MergeCategories(ctx, auth.MustBooksID(ctx), req.Id, req.Body.Into)
	if err != nil {
		return nil, err
	}

	return MergeAccount200JSONResponse(toAccountAPI(a)), nil
}

func (s *Server) ReopenAccount(ctx context.Context, req ReopenAccountRequestObject) (ReopenAccountResponseObject, error) {
	a, err := s.svc.ReopenAccount(ctx, auth.MustBooksID(ctx), req.Id)
	if err != nil {
		return nil, err
	}

	return ReopenAccount200JSONResponse(toAccountAPI(a)), nil
}

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

func (s *Server) ListTransactions(ctx context.Context, req ListTransactionsRequestObject) (ListTransactionsResponseObject, error) {
	p, err := listPage[app.TransactionCursor](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}

	q := app.TransactionQuery{
		BooksID: auth.MustBooksID(ctx), AccountID: optUUID(req.Params.AccountId), PayeeID: optUUID(req.Params.PayeeId),
		Tag: optString(req.Params.Tag), Q: optString(req.Params.Q), From: optDate(req.Params.From), To: optDate(req.Params.To), Limit: p.Limit, After: p.After,
		AmountMin: req.Params.AmountMin, AmountMax: req.Params.AmountMax,
		Uncategorized: req.Params.Uncategorized != nil && *req.Params.Uncategorized,
	}

	rows, next, err := s.svc.ListTransactions(ctx, q)
	if err != nil {
		return nil, err
	}

	out := ListTransactions200JSONResponse{Items: make([]Transaction, len(rows))}
	for i, t := range rows {
		out.Items[i] = toTransactionAPI(t)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) CreateTransaction(ctx context.Context, req CreateTransactionRequestObject) (CreateTransactionResponseObject, error) {
	in, err := fromTransactionInput(ctx, *req.Body, s.svc.AmountOf)
	if err != nil {
		return nil, err
	}

	t, err := s.svc.RecordTransaction(ctx, auth.MustBooksID(ctx), in)
	if err != nil {
		return nil, err
	}

	return CreateTransaction201JSONResponse{Body: toTransactionAPI(t), Headers: CreateTransaction201ResponseHeaders{Location: location("/transactions/", t.ID)}}, nil
}

func (s *Server) GetTransaction(ctx context.Context, req GetTransactionRequestObject) (GetTransactionResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	t, err := s.svc.Transaction(ctx, booksID, req.Id)
	if err != nil {
		return nil, err
	}

	refs, err := s.svc.ReferencedBy(ctx, booksID, req.Id)
	if err != nil {
		return nil, err
	}

	out := toTransactionAPI(t)

	referencedBy := make([]LinkReference, len(refs))
	for i, r := range refs {
		referencedBy[i] = LinkReference{Type: LinkReferenceType(r.Type), Source: r.Source, Amount: linkAmountAPI(r.Amount, r.Currency)}
	}

	out.ReferencedBy = &referencedBy

	return GetTransaction200JSONResponse(out), nil
}

func (s *Server) CorrectTransaction(ctx context.Context, req CorrectTransactionRequestObject) (CorrectTransactionResponseObject, error) {
	b := req.Body

	in, err := fromTransactionInput(ctx, TransactionInput{
		Date: b.Date, Description: b.Description, PayeeId: b.PayeeId, Tags: b.Tags, Links: b.Links, Postings: b.Postings,
	}, s.svc.AmountOf)
	if err != nil {
		return nil, err
	}

	t, err := s.svc.CorrectTransaction(ctx, auth.MustBooksID(ctx), req.Id, b.ExpectedVersion, in, b.Reason)
	if err != nil {
		return nil, err
	}

	return CorrectTransaction200JSONResponse(toTransactionAPI(t)), nil
}

func (s *Server) VoidTransaction(ctx context.Context, req VoidTransactionRequestObject) (VoidTransactionResponseObject, error) {
	booksID := auth.MustBooksID(ctx)
	if err := s.svc.VoidTransaction(ctx, booksID, req.Id, req.Body.Reason); err != nil {
		return nil, err
	}

	t, err := s.svc.Transaction(ctx, booksID, req.Id)
	if err != nil {
		return nil, err
	}

	return VoidTransaction200JSONResponse(toTransactionAPI(t)), nil
}

func (s *Server) CategorizeTransaction(ctx context.Context, req CategorizeTransactionRequestObject) (CategorizeTransactionResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	c := app.Categorization{
		TransactionID: req.Id, ExpectedVersion: req.Body.ExpectedVersion, PayeeID: req.Body.PayeeId,
		Parts: make([]domain.CategoryPart, len(req.Body.Parts)), Cause: app.Cause{Method: app.MethodManual},
	}
	for i, p := range req.Body.Parts {
		amount, err := fromMoneyAPI(fmt.Sprintf("parts[%d].amount", i), p.Amount)
		if err != nil {
			return nil, err
		}

		c.Parts[i] = domain.CategoryPart{AccountID: p.AccountId, Amount: amount}
	}

	errs, err := s.svc.Categorize(ctx, booksID, []app.Categorization{c})
	if err != nil {
		return nil, err
	}

	if errs[0] != nil {
		return nil, errs[0]
	}

	t, err := s.svc.Transaction(ctx, booksID, req.Id)
	if err != nil {
		return nil, err
	}

	return CategorizeTransaction200JSONResponse(toTransactionAPI(t)), nil
}

func (s *Server) CategorizeTransactions(ctx context.Context, req CategorizeTransactionsRequestObject) (CategorizeTransactionsResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	items := make([]app.BulkItem, len(req.Body.Items))
	for i, it := range req.Body.Items {
		items[i] = app.BulkItem{ID: it.Id, ExpectedVersion: it.ExpectedVersion}
	}

	errs, err := s.svc.CategorizeMany(ctx, booksID, req.Body.CategoryId, items)
	if err != nil {
		return nil, err
	}

	out := CategorizeTransactions200JSONResponse{Results: make([]BulkCategorizeItemResult, len(items))}
	for i, it := range items {
		r := BulkCategorizeItemResult{Id: it.ID, Status: bulkStatus(errs[i])}
		if errs[i] == nil {
			t, err := s.svc.Transaction(ctx, booksID, it.ID)
			if err != nil {
				return nil, err
			}

			r.Version = &t.Version
		}

		out.Results[i] = r
	}

	return out, nil
}

// bulkStatus names an item error by the problem code of the same failure (A78).
func bulkStatus(err error) BulkCategorizeItemResultStatus {
	switch {
	case err == nil:
		return BulkCategorizeItemResultStatusCategorized
	case errors.Is(err, app.ErrNotFound):
		return BulkCategorizeItemResultStatusNotFound
	case errors.Is(err, domain.ErrVersionConflict):
		return BulkCategorizeItemResultStatusVersionConflict
	case errors.Is(err, domain.ErrVoided):
		return BulkCategorizeItemResultStatusTransactionVoided
	}

	return BulkCategorizeItemResultStatusNotCategorizable
}

func (s *Server) VoidTransactions(ctx context.Context, req VoidTransactionsRequestObject) (VoidTransactionsResponseObject, error) {
	ids := make([]uuid.UUID, len(req.Body.Items))
	for i, it := range req.Body.Items {
		ids[i] = it.Id
	}

	errs, err := s.svc.VoidMany(ctx, auth.MustBooksID(ctx), ids, req.Body.Reason)
	if err != nil {
		return nil, err
	}

	out := VoidTransactions200JSONResponse{Results: make([]BulkVoidItemResult, len(ids))}
	for i, id := range ids {
		status, ok := voidStatus(errs[i])
		if !ok {
			return nil, errs[i]
		}

		out.Results[i] = BulkVoidItemResult{Id: id, Status: status}
	}

	return out, nil
}

// voidStatus names an item error by the problem code of the same failure (A202); ok is
// false for an error outside the status list.
func voidStatus(err error) (BulkVoidItemResultStatus, bool) {
	switch {
	case err == nil:
		return BulkVoidItemResultStatusVoided, true
	case errors.Is(err, app.ErrNotFound):
		return BulkVoidItemResultStatusNotFound, true
	case errors.Is(err, domain.ErrVoided):
		return BulkVoidItemResultStatusTransactionVoided, true
	case errors.Is(err, domain.ErrReconciled):
		return BulkVoidItemResultStatusPostingReconciled, true
	case errors.Is(err, app.ErrLaterSaleExists):
		return BulkVoidItemResultStatusLaterSaleExists, true
	}

	return "", false
}

func (s *Server) TransferTransaction(ctx context.Context, req TransferTransactionRequestObject) (TransferTransactionResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	in := app.TransferRequest{
		TransactionID: req.Id, ExpectedVersion: req.Body.ExpectedVersion, AccountID: req.Body.AccountId, Cause: app.Cause{Method: app.MethodManual},
	}
	if req.Body.PairWith != nil {
		in.PairWith = *req.Body.PairWith
	}

	res, err := s.svc.Transfer(ctx, booksID, in)
	if err != nil {
		return nil, err
	}

	t, err := s.svc.Transaction(ctx, booksID, res.Kept)
	if err != nil {
		return nil, err
	}

	out := TransferTransaction200JSONResponse{Transaction: toTransactionAPI(t)}
	if res.Voided != uuid.Nil {
		out.VoidedTransactionId = &res.Voided
	}

	return out, nil
}

func (s *Server) ReimburseTransaction(ctx context.Context, req ReimburseTransactionRequestObject) (ReimburseTransactionResponseObject, error) {
	booksID := auth.MustBooksID(ctx)

	in := app.ReimbursementRequest{
		TransactionID: req.Id, ExpectedVersion: req.Body.ExpectedVersion, Cause: app.Cause{Method: app.MethodManual},
		Allocations: make([]app.AllocationRequest, len(req.Body.Allocations)),
	}
	for i, a := range req.Body.Allocations {
		amount, err := fromMoneyAPI(fmt.Sprintf("allocations[%d].amount", i), a.Amount)
		if err != nil {
			return nil, err
		}

		in.Allocations[i] = app.AllocationRequest{OriginalID: a.OriginalId, Amount: amount}
		if a.CategoryId != nil {
			in.Allocations[i].CategoryID = *a.CategoryId
		}
	}

	done, err := s.svc.Reimburse(ctx, booksID, in)
	if err != nil {
		return nil, err
	}

	t, err := s.svc.Transaction(ctx, booksID, done.ID)
	if err != nil {
		return nil, err
	}

	return ReimburseTransaction200JSONResponse(toTransactionAPI(t)), nil
}

func (s *Server) ListReimbursementCandidates(ctx context.Context, req ListReimbursementCandidatesRequestObject) (ListReimbursementCandidatesResponseObject, error) {
	candidates, suggestion, err := s.svc.ReimbursementCandidates(ctx, auth.MustBooksID(ctx), req.Id)
	if err != nil {
		return nil, err
	}

	out := ListReimbursementCandidates200JSONResponse{Items: make([]ReimbursementCandidate, len(candidates))}
	for i, c := range candidates {
		out.Items[i] = ReimbursementCandidate{
			Transaction: toTransactionAPI(c.Transaction), Remaining: toMoneyAPI(c.Remaining), Allocated: toMoneyAPI(c.Allocated),
		}
	}

	if len(suggestion) > 0 {
		out.Suggestion = &suggestion
	}

	return out, nil
}

func (s *Server) ListReimbursementSources(ctx context.Context, req ListReimbursementSourcesRequestObject) (ListReimbursementSourcesResponseObject, error) {
	sources, err := s.svc.ReimbursementSources(ctx, auth.MustBooksID(ctx), req.Id)
	if err != nil {
		return nil, err
	}

	out := ListReimbursementSources200JSONResponse{Items: make([]ReimbursementSource, len(sources))}
	for i, c := range sources {
		out.Items[i] = ReimbursementSource{Transaction: toTransactionAPI(c.Transaction), Free: toMoneyAPI(c.Free)}
	}

	return out, nil
}

func (s *Server) ListTransactionVersions(ctx context.Context, req ListTransactionVersionsRequestObject) (ListTransactionVersionsResponseObject, error) {
	versions, err := s.svc.Versions(ctx, auth.MustBooksID(ctx), req.Id)
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

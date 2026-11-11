package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

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

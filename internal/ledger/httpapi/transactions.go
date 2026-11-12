package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Server) listTransactions(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (TransactionPage, error) {
	params, err := httpserver.Query[ListTransactionsParams](r)
	if err != nil {
		return TransactionPage{}, err
	}

	p, err := listPage[app.TransactionCursor](params.Limit, params.Cursor)
	if err != nil {
		return TransactionPage{}, err
	}

	q := app.TransactionQuery{
		BooksID: auth.MustBooksID(
			ctx,
		),
		AccountID: optUUID(params.AccountId),
		PayeeID:   optUUID(params.PayeeId),
		Tag: optString(
			params.Tag,
		),
		Q:             optString(params.Q),
		From:          optDate(params.From),
		To:            optDate(params.To),
		Limit:         p.Limit,
		After:         p.After,
		AmountMin:     params.AmountMin,
		AmountMax:     params.AmountMax,
		Uncategorized: params.Uncategorized != nil && *params.Uncategorized,
		ExcludeVoided: params.ExcludeVoided != nil && *params.ExcludeVoided,
	}

	rows, next, err := s.svc.ListTransactions(ctx, q)
	if err != nil {
		return TransactionPage{}, err
	}

	out := TransactionPage{Items: make([]Transaction, len(rows))}
	for i, t := range rows {
		out.Items[i] = toTransactionAPI(t)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) createTransaction(
	ctx context.Context,
	r *http.Request,
	in CreateTransactionJSONRequestBody,
) (Transaction, string, error) {
	input, err := fromTransactionInput(ctx, in, s.svc.AmountOf)
	if err != nil {
		return Transaction{}, "", err
	}

	t, err := s.svc.RecordTransaction(ctx, auth.MustBooksID(ctx), input)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) getTransaction(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Transaction, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, err
	}

	booksID := auth.MustBooksID(ctx)

	t, err := s.svc.Transaction(ctx, booksID, id)
	if err != nil {
		return Transaction{}, err
	}

	refs, err := s.svc.ReferencedBy(ctx, booksID, id)
	if err != nil {
		return Transaction{}, err
	}

	out := toTransactionAPI(t)

	referencedBy := make([]LinkReference, len(refs))
	for i, rec := range refs {
		referencedBy[i] = LinkReference{
			Type:   LinkReferenceType(rec.Type),
			Source: rec.Source,
			Amount: linkAmountAPI(rec.Amount, rec.Currency),
		}
	}

	out.ReferencedBy = &referencedBy

	return out, nil
}

func (s *Server) correctTransaction(
	ctx context.Context,
	r *http.Request,
	in CorrectTransactionJSONRequestBody,
) (Transaction, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, err
	}

	b := in

	input, err := fromTransactionInput(ctx, TransactionInput{
		Date:        b.Date,
		Description: b.Description,
		PayeeId:     b.PayeeId,
		Tags:        b.Tags,
		Links:       b.Links,
		Postings:    b.Postings,
	}, s.svc.AmountOf)
	if err != nil {
		return Transaction{}, err
	}

	t, err := s.svc.CorrectTransaction(
		ctx,
		auth.MustBooksID(ctx),
		id,
		b.ExpectedVersion,
		input,
		b.Reason,
	)
	if err != nil {
		return Transaction{}, err
	}

	return toTransactionAPI(t), nil
}

func (s *Server) voidTransaction(
	ctx context.Context,
	r *http.Request,
	in VoidTransactionJSONRequestBody,
) (Transaction, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, err
	}

	booksID := auth.MustBooksID(ctx)
	if err := s.svc.VoidTransaction(ctx, booksID, id, in.Reason); err != nil {
		return Transaction{}, err
	}

	t, err := s.svc.Transaction(ctx, booksID, id)
	if err != nil {
		return Transaction{}, err
	}

	return toTransactionAPI(t), nil
}

func (s *Server) voidTransactions(
	ctx context.Context,
	r *http.Request,
	in VoidTransactionsJSONRequestBody,
) (BulkVoidResult, error) {
	ids := make([]uuid.UUID, len(in.Items))
	for i, it := range in.Items {
		ids[i] = it.Id
	}

	errs, err := s.svc.VoidMany(ctx, auth.MustBooksID(ctx), ids, in.Reason)
	if err != nil {
		return BulkVoidResult{}, err
	}

	out := BulkVoidResult{Results: make([]BulkVoidItemResult, len(ids))}
	for i, id := range ids {
		status, ok := voidStatus(errs[i])
		if !ok {
			return BulkVoidResult{}, errs[i]
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

func (s *Server) transferTransaction(
	ctx context.Context,
	r *http.Request,
	in TransferTransactionJSONRequestBody,
) (TransferResult, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return TransferResult{}, err
	}

	booksID := auth.MustBooksID(ctx)

	input := app.TransferRequest{
		TransactionID:   id,
		ExpectedVersion: in.ExpectedVersion,
		AccountID:       in.AccountId,
		Cause:           app.Cause{Method: app.MethodManual},
	}
	if in.PairWith != nil {
		input.PairWith = *in.PairWith
	}

	res, err := s.svc.Transfer(ctx, booksID, input)
	if err != nil {
		return TransferResult{}, err
	}

	t, err := s.svc.Transaction(ctx, booksID, res.Kept)
	if err != nil {
		return TransferResult{}, err
	}

	out := TransferResult{Transaction: toTransactionAPI(t)}
	if res.Voided != uuid.Nil {
		out.VoidedTransactionId = &res.Voided
	}

	return out, nil
}

func (s *Server) listTransactionVersions(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (TransactionVersionList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return TransactionVersionList{}, err
	}

	versions, err := s.svc.Versions(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return TransactionVersionList{}, err
	}

	out := TransactionVersionList{Items: make([]TransactionVersion, len(versions))}
	for i, v := range versions {
		out.Items[i] = TransactionVersion{
			Version:     v.Version,
			Reason:      v.Reason,
			ReplacedAt:  v.ReplacedAt,
			Transaction: toTransactionAPI(v.Transaction),
		}
	}

	return out, nil
}

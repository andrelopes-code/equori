package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Server) listPayees(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (PayeeList, error) {
	params, err := httpserver.Query[ListPayeesParams](r)
	if err != nil {
		return PayeeList{}, err
	}

	p, err := listPage[app.PayeeKey](params.Limit, params.Cursor)
	if err != nil {
		return PayeeList{}, err
	}

	rows, next, err := s.svc.ListPayees(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return PayeeList{}, err
	}

	out := PayeeList{Items: make([]Payee, len(rows))}
	for i, rec := range rows {
		out.Items[i] = toPayeeAPI(rec)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) createPayee(
	ctx context.Context,
	r *http.Request,
	in CreatePayeeJSONRequestBody,
) (Payee, error) {
	p, err := s.svc.CreatePayee(ctx, auth.MustBooksID(ctx), in.Name)
	if err != nil {
		return Payee{}, err
	}

	return toPayeeAPI(p), nil
}

func (s *Server) renamePayee(
	ctx context.Context,
	r *http.Request,
	in RenamePayeeJSONRequestBody,
) (Payee, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Payee{}, err
	}

	p, err := s.svc.RenamePayee(ctx, auth.MustBooksID(ctx), id, in.Name)
	if err != nil {
		return Payee{}, err
	}

	return Payee{Id: p.ID, Name: p.Name}, nil
}

func (s *Server) mergePayee(
	ctx context.Context,
	r *http.Request,
	in MergePayeeJSONRequestBody,
) (Payee, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Payee{}, err
	}

	p, err := s.svc.MergePayees(ctx, auth.MustBooksID(ctx), id, in.Into)
	if err != nil {
		return Payee{}, err
	}

	return Payee{Id: p.ID, Name: p.Name}, nil
}

package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

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

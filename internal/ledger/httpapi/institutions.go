package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

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

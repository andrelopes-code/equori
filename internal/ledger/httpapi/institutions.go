package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Server) listInstitutions(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (InstitutionList, error) {
	params, err := httpserver.Query[ListInstitutionsParams](r)
	if err != nil {
		return InstitutionList{}, err
	}

	p, err := listPage[app.InstitutionKey](params.Limit, params.Cursor)
	if err != nil {
		return InstitutionList{}, err
	}

	rows, next, err := s.svc.ListInstitutions(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return InstitutionList{}, err
	}

	out := InstitutionList{Items: make([]Institution, len(rows))}
	for i, rec := range rows {
		out.Items[i] = toInstitutionAPI(rec)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) createInstitution(
	ctx context.Context,
	r *http.Request,
	in CreateInstitutionJSONRequestBody,
) (Institution, error) {
	i, err := s.svc.CreateInstitution(ctx, auth.MustBooksID(ctx), app.Institution{Name: in.Name, Code: optString(in.Code), Identifier: institutionIdentifier(in.Identifier)})
	if err != nil {
		return Institution{}, err
	}

	return toInstitutionAPI(i), nil
}

func (s *Server) setInstitutionIdentifier(
	ctx context.Context,
	r *http.Request,
	in SetInstitutionIdentifierJSONRequestBody,
) (Institution, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Institution{}, err
	}

	ident := app.InstitutionIdentifier{Scheme: optString(in.Scheme), Value: optString(in.Identifier)}
	if (ident.Scheme == "") != (ident.Value == "") {
		field := "identifier"
		if ident.Scheme == "" {
			field = "scheme"
		}

		return Institution{}, &domain.FieldError{Field: field, Message: "must be set together with the other identifier field", Err: domain.ErrValidation}
	}

	i, err := s.svc.SetInstitutionIdentifier(ctx, auth.MustBooksID(ctx), id, ident)
	if err != nil {
		return Institution{}, err
	}

	return toInstitutionAPI(i), nil
}

func (s *Server) deleteInstitution(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteInstitution(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) listInstitutionIdentifierSchemes(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (InstitutionIdentifierSchemeList, error) {
	schemes := s.svc.InstitutionIdentifierSchemes()

	out := InstitutionIdentifierSchemeList{Items: make([]InstitutionIdentifierScheme, len(schemes))}
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

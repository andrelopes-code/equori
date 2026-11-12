package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/classification/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toAliasAPI(a domain.Alias) PayeeAlias {
	return PayeeAlias{
		Id:        a.ID,
		Pattern:   a.Pattern,
		MatchType: PayeeAliasMatchType(a.MatchType),
		PayeeId:   a.PayeeID,
	}
}

func fromAliasInput(in PayeeAliasInput) domain.Alias {
	return domain.Alias{
		Pattern:   in.Pattern,
		MatchType: domain.MatchType(in.MatchType),
		PayeeID:   in.PayeeId,
	}
}

func (s *Server) listPayeeAliases(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (PayeeAliasPage, error) {
	params, err := httpserver.Query[ListPayeeAliasesParams](r)
	if err != nil {
		return PayeeAliasPage{}, err
	}

	p, err := listPage[app.AliasKey](params.Limit, params.Cursor)
	if err != nil {
		return PayeeAliasPage{}, err
	}

	aliases, next, err := s.svc.ListAliases(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return PayeeAliasPage{}, err
	}

	out := PayeeAliasPage{Items: make([]PayeeAlias, len(aliases))}
	for i, a := range aliases {
		out.Items[i] = toAliasAPI(a)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) createPayeeAlias(
	ctx context.Context, _ *http.Request, in CreatePayeeAliasJSONRequestBody,
) (PayeeAlias, string, error) {
	a, err := s.svc.CreateAlias(ctx, auth.MustBooksID(ctx), fromAliasInput(in))
	if err != nil {
		return PayeeAlias{}, "", err
	}

	return toAliasAPI(a), BaseURL + "/payee-aliases/" + a.ID.String(), nil
}

func (s *Server) getPayeeAlias(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (PayeeAlias, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return PayeeAlias{}, err
	}

	a, err := s.svc.Alias(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return PayeeAlias{}, err
	}

	return toAliasAPI(a), nil
}

func (s *Server) changePayeeAlias(
	ctx context.Context, r *http.Request, body ChangePayeeAliasJSONRequestBody,
) (PayeeAlias, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return PayeeAlias{}, err
	}

	in := fromAliasInput(body)
	in.ID = id

	a, err := s.svc.ChangeAlias(ctx, auth.MustBooksID(ctx), in)
	if err != nil {
		return PayeeAlias{}, err
	}

	return toAliasAPI(a), nil
}

func (s *Server) deletePayeeAlias(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteAlias(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

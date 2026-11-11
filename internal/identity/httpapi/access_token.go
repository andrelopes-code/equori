package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listAccessTokens(ctx context.Context, _ *http.Request, _ httpserver.None) (AccessTokenList, error) {
	tokens, err := s.svc.AccessTokens(ctx, auth.MustMemberID(ctx), auth.MustBooksID(ctx))
	if err != nil {
		return AccessTokenList{}, err
	}

	items := make([]AccessToken, 0, len(tokens))
	for _, t := range tokens {
		items = append(items, toAPIAccessToken(t))
	}

	return AccessTokenList{Items: items}, nil
}

func (s *Server) createAccessToken(
	ctx context.Context,
	_ *http.Request,
	in CreateAccessTokenJSONRequestBody,
) (AccessToken, error) {
	text, t, err := s.svc.CreateAccessToken(
		ctx,
		auth.MustMemberID(ctx),
		auth.MustBooksID(ctx),
		auth.MustBookRole(ctx),
		in.Name,
		in.Scope,
		in.ExpiresInDays,
	)
	if err != nil {
		return AccessToken{}, err
	}

	out := toAPIAccessToken(t)
	out.Token = &text

	return out, nil
}

func (s *Server) deleteAccessToken(ctx context.Context, r *http.Request, _ httpserver.None) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteAccessToken(ctx, auth.MustMemberID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func toAPIAccessToken(t domain.AccessToken) AccessToken {
	return AccessToken{Id: t.ID, Name: t.Name, Scope: t.Scope, CreatedAt: t.CreatedAt, ExpiresAt: t.ExpiresAt, LastUsedAt: t.LastUsedAt}
}

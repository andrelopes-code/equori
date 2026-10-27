package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) ListAccessTokens(ctx context.Context, _ ListAccessTokensRequestObject) (ListAccessTokensResponseObject, error) {
	tokens, err := s.svc.AccessTokens(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	items := make([]AccessToken, 0, len(tokens))
	for _, t := range tokens {
		items = append(items, toAPIAccessToken(t))
	}
	return ListAccessTokens200JSONResponse{Items: items}, nil
}

func (s *Server) CreateAccessToken(ctx context.Context, req CreateAccessTokenRequestObject) (CreateAccessTokenResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}
	text, t, err := s.svc.CreateAccessToken(ctx, auth.MustUserID(ctx), req.Body.Name, req.Body.Scope, req.Body.ExpiresInDays)
	if err != nil {
		return nil, err
	}
	out := toAPIAccessToken(t)
	out.Token = &text
	return CreateAccessToken201JSONResponse(out), nil
}

func (s *Server) DeleteAccessToken(ctx context.Context, req DeleteAccessTokenRequestObject) (DeleteAccessTokenResponseObject, error) {
	if err := s.svc.DeleteAccessToken(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return DeleteAccessToken204Response{}, nil
}

func toAPIAccessToken(t domain.AccessToken) AccessToken {
	return AccessToken{Id: t.ID, Name: t.Name, Scope: t.Scope, CreatedAt: t.CreatedAt, ExpiresAt: t.ExpiresAt, LastUsedAt: t.LastUsedAt}
}

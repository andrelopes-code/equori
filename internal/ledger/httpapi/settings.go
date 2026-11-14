package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) getSettings(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Settings, error) {
	st, err := s.svc.Settings(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return Settings{}, err
	}

	return Settings{BaseCurrency: string(st.BaseCurrency)}, nil
}

func (s *Server) updateSettings(
	ctx context.Context,
	r *http.Request,
	in UpdateSettingsJSONRequestBody,
) (Settings, error) {
	if err := s.svc.SetBaseCurrency(
		ctx,
		auth.MustBooksID(ctx),
		money.Currency(in.BaseCurrency),
	); err != nil {
		return Settings{}, err
	}

	return in, nil
}

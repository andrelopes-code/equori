package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) getSetup(ctx context.Context, _ *http.Request, _ httpserver.None) (SetupStatus, error) {
	required, err := s.svc.SetupRequired(ctx)
	if err != nil {
		return SetupStatus{}, err
	}

	return SetupStatus{Required: required}, nil
}

// completeSetup answers 201 with the session cookie.
func (s *Server) completeSetup(w http.ResponseWriter, r *http.Request) {
	b, ok := decodeBody[CompleteSetupJSONRequestBody](s, w, r)
	if !ok {
		return
	}

	ctx := r.Context()

	session, user, err := s.svc.CompleteSetup(ctx, app.SetupRequest{
		Token:        b.Token,
		Email:        b.Email,
		Password:     b.Password,
		Locale:       locale.Locale{Language: b.Language, Region: b.Region},
		BaseCurrency: money.Currency(deref(b.BaseCurrency)),
		UpdateCheck:  b.UpdateCheck,
		BooksName:    b.BooksName,
		TimeZone:     b.TimeZone,
	})
	if err != nil {
		s.errs.Write(w, r, err)
		return
	}

	s.log.InfoContext(ctx, "first member created", "member_id", user.ID, "request_id", httpserver.RequestID(ctx))
	cookie := s.cookie(session.Token, session.ExpiresAt)
	body := toAPIUser(user, locale.Locale{Language: user.Language, Region: b.Region}, session.BooksID, auth.RoleOwner)

	s.writeJSONCookie(w, r, http.StatusCreated, cookie, body)
}

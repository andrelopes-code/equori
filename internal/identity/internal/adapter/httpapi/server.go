package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const (
	CookieName = "equori_session"
	BaseURL    = "/api/v1"
)

var _ StrictServerInterface = (*Server)(nil)

type Server struct {
	svc           *app.Service
	secureCookies bool
	log           *slog.Logger
	errs          httpserver.ErrorWriter
}

func NewServer(svc *app.Service, secureCookies bool, log *slog.Logger) *Server {
	return &Server{svc: svc, secureCookies: secureCookies, log: log, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.errs.WriteRequestError,
		ResponseErrorHandlerFunc: s.errs.Write,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{
		BaseURL:          BaseURL,
		BaseRouter:       mux,
		ErrorHandlerFunc: s.errs.WriteRequestError,
	})
}

type userKey struct{}

// RequireSession rejects every /api/ request without a valid session, except login.
// Deny by default: a new endpoint is protected without opting in.
func (s *Server) RequireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isAPI(r) || isLogin(r) {
			next.ServeHTTP(w, r)
			return
		}
		cookie, err := r.Cookie(CookieName)
		if err != nil {
			s.errs.Write(w, r, app.ErrUnauthenticated)
			return
		}
		user, err := s.svc.Authenticate(r.Context(), cookie.Value)
		if err != nil {
			s.errs.Write(w, r, err)
			return
		}
		ctx := auth.WithUserID(r.Context(), user.ID)
		ctx = context.WithValue(ctx, userKey{}, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isAPI(r *http.Request) bool {
	return strings.HasPrefix(r.URL.Path, "/api/")
}

func isLogin(r *http.Request) bool {
	return r.Method == http.MethodPost && r.URL.Path == BaseURL+"/session"
}

func (s *Server) CreateSession(ctx context.Context, req CreateSessionRequestObject) (CreateSessionResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}
	session, err := s.svc.Login(ctx, req.Body.Email, req.Body.Password)
	switch {
	case errors.Is(err, app.ErrInvalidCredentials), errors.Is(err, app.ErrTooManyAttempts):
		s.log.WarnContext(ctx, "login failed", "email", req.Body.Email, "reason", err.Error(),
			"request_id", httpserver.RequestID(ctx))
		return nil, err
	case err != nil:
		return nil, err
	}
	s.log.InfoContext(ctx, "login succeeded", "user_id", session.UserID, "request_id", httpserver.RequestID(ctx))
	cookie := s.cookie(session.Token, session.ExpiresAt)
	return CreateSession204Response{Headers: CreateSession204ResponseHeaders{SetCookie: &cookie}}, nil
}

func (s *Server) DeleteSession(ctx context.Context, req DeleteSessionRequestObject) (DeleteSessionResponseObject, error) {
	if req.Params.EquoriSession != nil {
		if err := s.svc.Logout(ctx, *req.Params.EquoriSession); err != nil {
			return nil, err
		}
	}
	cookie := s.cookie("", time.Unix(0, 0))
	return DeleteSession204Response{Headers: DeleteSession204ResponseHeaders{SetCookie: &cookie}}, nil
}

func (s *Server) GetCurrentUser(ctx context.Context, _ GetCurrentUserRequestObject) (GetCurrentUserResponseObject, error) {
	user, ok := ctx.Value(userKey{}).(domain.User)
	if !ok {
		return nil, app.ErrUnauthenticated
	}
	return GetCurrentUser200JSONResponse(toAPIUser(user)), nil
}

func (s *Server) UpdateCurrentUser(ctx context.Context, req UpdateCurrentUserRequestObject) (UpdateCurrentUserResponseObject, error) {
	user, ok := ctx.Value(userKey{}).(domain.User)
	if !ok {
		return nil, app.ErrUnauthenticated
	}
	if req.Body == nil {
		return nil, errInvalidRequest
	}
	updated, err := s.svc.UpdateProfile(ctx, user, deref(req.Body.Language), deref(req.Body.Region))
	if err != nil {
		return nil, err
	}
	return UpdateCurrentUser200JSONResponse(toAPIUser(updated)), nil
}

func toAPIUser(u domain.User) User {
	return User{Id: u.ID, Email: u.Email, Role: UserRole(u.Role), Language: u.Language, Region: u.Region}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (s *Server) cookie(value string, expires time.Time) string {
	//nolint:gosec // G124: Secure is false only when EQUORI_INSECURE_COOKIES=true (ADR 003).
	c := http.Cookie{
		Name:     CookieName,
		Value:    value,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   s.secureCookies,
		SameSite: http.SameSiteLaxMode,
	}
	return c.String()
}

var errInvalidRequest = errors.New("invalid request")

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004).
func ToProblem(err error) (problem.Details, bool) {
	if fe, ok := errors.AsType[*domain.FieldError](err); ok {
		d := problem.New(http.StatusUnprocessableEntity, "validation_failed", fe.Error())
		d.Errors = []problem.FieldError{{Field: fe.Field, Message: fe.Message}}
		return d, true
	}
	switch {
	case errors.Is(err, errInvalidRequest):
		return problem.New(http.StatusBadRequest, "invalid_request", "malformed request"), true
	case errors.Is(err, app.ErrInvalidCredentials):
		return problem.New(http.StatusUnauthorized, "invalid_credentials", "email or password is incorrect"), true
	case errors.Is(err, app.ErrUnauthenticated):
		return problem.New(http.StatusUnauthorized, "unauthenticated", "a valid session is required"), true
	case errors.Is(err, app.ErrTooManyAttempts):
		return problem.New(http.StatusTooManyRequests, "too_many_attempts", "too many login attempts; retry in 15 minutes"), true
	case errors.Is(err, app.ErrBusy):
		return problem.New(http.StatusServiceUnavailable, "server_busy", "server is busy; retry shortly"), true
	}
	return problem.Details{}, false
}

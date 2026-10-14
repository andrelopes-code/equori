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
}

func NewServer(svc *app.Service, secureCookies bool, log *slog.Logger) *Server {
	return &Server{svc: svc, secureCookies: secureCookies, log: log}
}

func (s *Server) Register(mux *http.ServeMux) {
	strict := NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  s.writeRequestError,
		ResponseErrorHandlerFunc: s.writeError,
	})
	HandlerWithOptions(strict, StdHTTPServerOptions{
		BaseURL:          BaseURL,
		BaseRouter:       mux,
		ErrorHandlerFunc: s.writeRequestError,
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
			s.writeError(w, r, app.ErrUnauthenticated)
			return
		}
		user, err := s.svc.Authenticate(r.Context(), cookie.Value)
		if err != nil {
			s.writeError(w, r, err)
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
	if err != nil {
		return nil, err
	}
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
	return GetCurrentUser200JSONResponse{Id: user.ID, Email: user.Email, Role: UserRole(user.Role)}, nil
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

func (s *Server) writeRequestError(w http.ResponseWriter, r *http.Request, err error) {
	s.writeError(w, r, errors.Join(errInvalidRequest, err))
}

func (s *Server) writeError(w http.ResponseWriter, r *http.Request, err error) {
	d := toProblem(err)
	d.RequestID = httpserver.RequestID(r.Context())
	if d.Status >= http.StatusInternalServerError {
		s.log.ErrorContext(r.Context(), "request failed", "error", err, "request_id", d.RequestID)
	}
	problem.Write(w, d)
}

func toProblem(err error) problem.Details {
	switch {
	case errors.Is(err, errInvalidRequest):
		return problem.New(http.StatusBadRequest, "invalid_request", "malformed request")
	case errors.Is(err, app.ErrInvalidCredentials):
		return problem.New(http.StatusUnauthorized, "invalid_credentials", "email or password is incorrect")
	case errors.Is(err, app.ErrUnauthenticated):
		return problem.New(http.StatusUnauthorized, "unauthenticated", "a valid session is required")
	case errors.Is(err, app.ErrTooManyAttempts):
		return problem.New(http.StatusTooManyRequests, "too_many_attempts", "too many failed login attempts; retry in 15 minutes")
	default:
		return problem.New(http.StatusInternalServerError, "internal_error", "")
	}
}

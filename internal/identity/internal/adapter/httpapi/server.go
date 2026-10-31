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
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

const (
	CookieName = "equori_session"
	BaseURL    = "/api/v1"

	rolePublic = "public"
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

type memberKey struct{}

// Authorize is the single authorization point for /api/ (HA9). required returns the x-book-role of
// the operation r matches, and whether r matches one. Deny by default: a path without an operation
// needs a session, and an operation without x-book-role is 403.
func (s *Server) Authorize(next http.Handler, required func(*http.Request) (role string, matched bool)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, matched := required(r)
		if !isAPI(r) || (matched && role == rolePublic) {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie(CookieName)
		if err != nil {
			s.errs.Write(w, r, app.ErrUnauthenticated)
			return
		}

		access, err := s.svc.Authenticate(r.Context(), cookie.Value)
		if err != nil {
			s.errs.Write(w, r, err)
			return
		}

		if matched && !access.Role.Allows(auth.BookRole(role)) {
			s.errs.Write(w, r, app.ErrBookRoleRequired)
			return
		}

		loc, err := s.svc.Location(r.Context(), access.BooksID)
		if err != nil {
			s.errs.Write(w, r, err)
			return
		}

		ctx := clock.WithLocation(auth.WithIdentity(r.Context(), access.Member.ID, access.BooksID, access.Role), loc)
		ctx = context.WithValue(ctx, memberKey{}, access.Member)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isAPI(r *http.Request) bool {
	return strings.HasPrefix(r.URL.Path, "/api/")
}

func (s *Server) GetSetup(ctx context.Context, _ GetSetupRequestObject) (GetSetupResponseObject, error) {
	required, err := s.svc.SetupRequired(ctx)
	if err != nil {
		return nil, err
	}

	return GetSetup200JSONResponse{Required: required}, nil
}

func (s *Server) CompleteSetup(ctx context.Context, req CompleteSetupRequestObject) (CompleteSetupResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	b := req.Body

	session, user, err := s.svc.CompleteSetup(ctx, b.Token, b.Email, b.Password,
		locale.Locale{Language: b.Language, Region: b.Region}, money.Currency(deref(b.BaseCurrency)))
	if err != nil {
		return nil, err
	}

	s.log.InfoContext(ctx, "first member created", "member_id", user.ID, "request_id", httpserver.RequestID(ctx))
	cookie := s.cookie(session.Token, session.ExpiresAt)

	return CompleteSetup201JSONResponse{Body: toAPIUser(user, locale.Locale{Language: user.Language, Region: b.Region}, session.BooksID, auth.RoleOwner), Headers: CompleteSetup201ResponseHeaders{SetCookie: &cookie}}, nil
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

	s.log.InfoContext(ctx, "login succeeded", "member_id", session.MemberID, "books_id", session.BooksID, "request_id", httpserver.RequestID(ctx))
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
	user, ok := ctx.Value(memberKey{}).(domain.Member)
	if !ok {
		return nil, app.ErrUnauthenticated
	}

	l, err := s.svc.Profile(ctx, auth.MustBooksID(ctx), user.ID)
	if err != nil {
		return nil, err
	}

	return GetCurrentUser200JSONResponse(toAPIUser(user, l, auth.MustBooksID(ctx), auth.MustBookRole(ctx))), nil
}

func (s *Server) UpdateCurrentUser(ctx context.Context, req UpdateCurrentUserRequestObject) (UpdateCurrentUserResponseObject, error) {
	user, ok := ctx.Value(memberKey{}).(domain.Member)
	if !ok {
		return nil, app.ErrUnauthenticated
	}

	if req.Body == nil {
		return nil, errInvalidRequest
	}

	l, err := s.svc.UpdateProfile(ctx, auth.MustBooksID(ctx), user.ID, deref(req.Body.Language), "")
	if err != nil {
		return nil, err
	}

	return UpdateCurrentUser200JSONResponse(toAPIUser(user, l, auth.MustBooksID(ctx), auth.MustBookRole(ctx))), nil
}

func toAPIUser(u domain.Member, l locale.Locale, booksID int64, role auth.BookRole) User {
	return User{Id: u.ID, Email: u.Email, Role: UserRole(u.Role), Language: l.Language, Region: l.Region, BooksId: booksID, BookRole: BookRole(role)}
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
	case errors.Is(err, app.ErrTimeZoneInvalid):
		return problem.New(http.StatusUnprocessableEntity, "time_zone_invalid", "the time zone is not an IANA time zone name"), true
	case errors.Is(err, app.ErrAppearanceTooLarge):
		return problem.New(http.StatusUnprocessableEntity, "appearance_too_large", "the appearance is over 16 KiB"), true
	case errors.Is(err, app.ErrInvalidCredentials):
		return problem.New(http.StatusUnauthorized, "invalid_credentials", "email or password is incorrect"), true
	case errors.Is(err, app.ErrUnauthenticated):
		return problem.New(http.StatusUnauthorized, "unauthenticated", "a valid session is required"), true
	case errors.Is(err, app.ErrTooManyAttempts):
		return problem.New(http.StatusTooManyRequests, "too_many_attempts", "too many login attempts; retry in 15 minutes"), true
	case errors.Is(err, app.ErrSetupTokenInvalid):
		return problem.New(http.StatusForbidden, "setup_token_invalid", "the setup token is not the one this instance issued"), true
	case errors.Is(err, app.ErrSetupComplete):
		return problem.New(http.StatusConflict, "setup_complete", "the first member exists; sign in instead"), true
	case errors.Is(err, app.ErrBookRoleRequired):
		return problem.New(http.StatusForbidden, "book_role_required", "the member's role in this book does not allow this operation"), true
	case errors.Is(err, app.ErrBooksNotFound):
		return problem.New(http.StatusNotFound, "books_not_found", "the member has no book with this ID"), true
	case errors.Is(err, app.ErrMemberNotFound):
		return problem.New(http.StatusNotFound, "member_not_found", "no member of this book has this ID"), true
	case errors.Is(err, app.ErrLastOwner):
		return problem.New(http.StatusConflict, "last_owner", "the book must keep at least one owner"), true
	case errors.Is(err, app.ErrAlreadyMember):
		return problem.New(http.StatusConflict, "already_member", "the email already has a membership in this book"), true
	case errors.Is(err, app.ErrInvitationNotFound):
		return problem.New(http.StatusNotFound, "invitation_not_found", "the invitation does not exist or expired"), true
	case errors.Is(err, app.ErrInvitationEmailMismatch):
		return problem.New(http.StatusForbidden, "invitation_email_mismatch", "the invitation is for another email"), true
	case errors.Is(err, app.ErrAccessTokenNotFound):
		return problem.New(http.StatusNotFound, "access_token_not_found", "no access token of the member has this ID"), true
	case errors.Is(err, app.ErrTOTPEnabled):
		return problem.New(http.StatusConflict, "totp_enabled", "the authenticator app is already enabled"), true
	case errors.Is(err, app.ErrTOTPCodeInvalid):
		return problem.New(http.StatusUnprocessableEntity, "totp_code_invalid", "the code does not match the secret"), true
	case errors.Is(err, app.ErrPasswordInvalid):
		return problem.New(http.StatusForbidden, "password_invalid", "the password is incorrect"), true
	case errors.Is(err, app.ErrPasskeyInvalid):
		return problem.New(http.StatusUnprocessableEntity, "passkey_invalid", "the passkey failed verification"), true
	case errors.Is(err, app.ErrPasskeyNotFound):
		return problem.New(http.StatusNotFound, "passkey_not_found", "the member has no passkey with this ID"), true
	case errors.Is(err, app.ErrSecondFactorInvalid):
		return problem.New(http.StatusUnauthorized, "second_factor_invalid", "the second factor is wrong"), true
	case errors.Is(err, app.ErrSecondFactorMissing):
		return problem.New(http.StatusConflict, "second_factor_missing", "the member has no second factor"), true
	case errors.Is(err, app.ErrSecretKeyMissing):
		return problem.New(http.StatusConflict, "secret_key_missing", "EQUORI_SECRET_KEY is not set"), true
	case errors.Is(err, app.ErrBusy):
		return problem.New(http.StatusServiceUnavailable, "server_busy", "server is busy; retry shortly"), true
	}

	return problem.Details{}, false
}

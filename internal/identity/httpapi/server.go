package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
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

	loginCookieName = "equori_login"
	rolePublic      = "public"
)

type Server struct {
	svc           *app.Service
	secureCookies bool
	log           *slog.Logger
	errs          httpserver.ErrorWriter
}

func NewServer(svc *app.Service, secureCookies bool, log *slog.Logger) *Server {
	return &Server{svc: svc, secureCookies: secureCookies, log: log, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

// Register lists every route of the identity operations; each handler sits in this package.
func (s *Server) Register(mux *http.ServeMux) {
	ok, created := http.StatusOK, http.StatusCreated

	mux.HandleFunc("POST "+BaseURL+"/session", s.createSession)
	mux.HandleFunc("DELETE "+BaseURL+"/session", s.deleteSession)
	mux.HandleFunc("GET "+BaseURL+"/setup", httpserver.Handle(s.errs, ok, s.getSetup))
	mux.HandleFunc("POST "+BaseURL+"/setup", s.completeSetup)
	mux.HandleFunc("GET "+BaseURL+"/me", httpserver.Handle(s.errs, ok, s.getCurrentUser))
	mux.HandleFunc("PATCH "+BaseURL+"/me", httpserver.Handle(s.errs, ok, s.updateCurrentUser))
	mux.HandleFunc("GET "+BaseURL+"/me/appearance", httpserver.Handle(s.errs, ok, s.getMemberAppearance))
	mux.HandleFunc("PUT "+BaseURL+"/me/appearance", httpserver.Handle(s.errs, ok, s.setMemberAppearance))
	mux.HandleFunc("GET "+BaseURL+"/books/current", httpserver.Handle(s.errs, ok, s.getCurrentBooks))
	mux.HandleFunc("PATCH "+BaseURL+"/books/current", httpserver.Handle(s.errs, ok, s.updateCurrentBooks))
	mux.HandleFunc("DELETE "+BaseURL+"/books/current", s.deleteCurrentBooks)
	mux.HandleFunc("GET "+BaseURL+"/me/books", httpserver.Handle(s.errs, ok, s.listMyBooks))
	mux.HandleFunc("POST "+BaseURL+"/books", httpserver.Handle(s.errs, created, s.createBooks))
	mux.HandleFunc("PUT "+BaseURL+"/session/books", httpserver.Handle(s.errs, ok, s.switchBooks))
	mux.HandleFunc("GET "+BaseURL+"/books/current/members", httpserver.Handle(s.errs, ok, s.listMembers))
	mux.HandleFunc("PATCH "+BaseURL+"/books/current/members/{memberId}", httpserver.Handle(s.errs, ok, s.updateMember))
	mux.HandleFunc("DELETE "+BaseURL+"/books/current/members/{memberId}", httpserver.Handle(s.errs, ok, s.removeMember))
	mux.HandleFunc("DELETE "+BaseURL+"/books/current/membership", s.leaveBooks)
	mux.HandleFunc("GET "+BaseURL+"/books/current/invitations", httpserver.Handle(s.errs, ok, s.listInvitations))
	mux.HandleFunc("POST "+BaseURL+"/books/current/invitations", httpserver.Handle(s.errs, created, s.createInvitation))
	mux.HandleFunc("DELETE "+BaseURL+"/books/current/invitations/{id}", httpserver.Handle(s.errs, ok, s.deleteInvitation))
	mux.HandleFunc("POST "+BaseURL+"/account-invitations", httpserver.Handle(s.errs, created, s.createAccountInvitation))
	mux.HandleFunc("POST "+BaseURL+"/invitations/preview", httpserver.Handle(s.errs, ok, s.previewInvitation))
	mux.HandleFunc("POST "+BaseURL+"/invitations/accept", s.acceptInvitation)
	mux.HandleFunc("GET "+BaseURL+"/access-tokens", httpserver.Handle(s.errs, ok, s.listAccessTokens))
	mux.HandleFunc("POST "+BaseURL+"/access-tokens", httpserver.Handle(s.errs, created, s.createAccessToken))
	mux.HandleFunc("DELETE "+BaseURL+"/access-tokens/{id}", httpserver.Handle(s.errs, ok, s.deleteAccessToken))
	mux.HandleFunc("GET "+BaseURL+"/me/second-factor", httpserver.Handle(s.errs, ok, s.getSecondFactor))
	mux.HandleFunc("POST "+BaseURL+"/me/totp", httpserver.Handle(s.errs, ok, s.startTotp))
	mux.HandleFunc("POST "+BaseURL+"/me/totp/confirm", httpserver.Handle(s.errs, ok, s.confirmTotp))
	mux.HandleFunc("POST "+BaseURL+"/me/totp/disable", httpserver.Handle(s.errs, ok, s.disableTotp))
	mux.HandleFunc("POST "+BaseURL+"/me/recovery-codes", httpserver.Handle(s.errs, ok, s.regenerateRecoveryCodes))
	mux.HandleFunc("POST "+BaseURL+"/me/passkeys/options", httpserver.Handle(s.errs, ok, s.createPasskeyOptions))
	mux.HandleFunc("POST "+BaseURL+"/me/passkeys", httpserver.Handle(s.errs, created, s.createPasskey))
	mux.HandleFunc("POST "+BaseURL+"/me/passkeys/{id}/remove", httpserver.Handle(s.errs, ok, s.removePasskey))
	mux.HandleFunc("POST "+BaseURL+"/session/second-factor", s.completeSecondFactor)
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

// createSession answers 204 with the session cookie, or 202 with the second factor challenge and
// the pending login cookie.
func (s *Server) createSession(w http.ResponseWriter, r *http.Request) {
	b, ok := decodeBody[CreateSessionJSONRequestBody](s, w, r)
	if !ok {
		return
	}

	ctx := r.Context()

	session, pending, err := s.svc.Login(ctx, b.Email, b.Password, r.Header.Get("Origin"))
	switch {
	case errors.Is(err, app.ErrInvalidCredentials), errors.Is(err, app.ErrTooManyAttempts):
		s.log.WarnContext(ctx, "login failed", "email", b.Email, "reason", err.Error(),
			"request_id", httpserver.RequestID(ctx))
		s.errs.Write(w, r, err)

		return
	case err != nil:
		s.errs.Write(w, r, err)
		return
	}

	if pending != nil {
		s.writePendingLogin(w, r, pending)
		return
	}

	s.log.InfoContext(ctx, "login succeeded", "member_id", session.MemberID, "books_id", session.BooksID,
		"method", app.MethodPassword, "request_id", httpserver.RequestID(ctx))

	w.Header().Set("Set-Cookie", s.cookie(session.Token, session.ExpiresAt))
	w.WriteHeader(http.StatusNoContent)
}

// deleteSession answers 204 with the expired session cookie.
func (s *Server) deleteSession(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(CookieName); err == nil {
		if err := s.svc.Logout(r.Context(), c.Value); err != nil {
			s.errs.Write(w, r, err)
			return
		}
	}

	w.Header().Set("Set-Cookie", s.cookie("", time.Unix(0, 0)))
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getCurrentUser(ctx context.Context, _ *http.Request, _ httpserver.None) (User, error) {
	user, ok := ctx.Value(memberKey{}).(domain.Member)
	if !ok {
		return User{}, app.ErrUnauthenticated
	}

	l, err := s.svc.Profile(ctx, auth.MustBooksID(ctx), user.ID)
	if err != nil {
		return User{}, err
	}

	return toAPIUser(user, l, auth.MustBooksID(ctx), auth.MustBookRole(ctx)), nil
}

func (s *Server) updateCurrentUser(
	ctx context.Context,
	_ *http.Request,
	in UpdateCurrentUserJSONRequestBody,
) (User, error) {
	user, ok := ctx.Value(memberKey{}).(domain.Member)
	if !ok {
		return User{}, app.ErrUnauthenticated
	}

	if in.DisplayName != nil {
		name, err := s.svc.SetDisplayName(ctx, user.ID, *in.DisplayName)
		if err != nil {
			return User{}, err
		}

		user.DisplayName = name
	}

	l, err := s.svc.UpdateProfile(ctx, auth.MustBooksID(ctx), user.ID, deref(in.Language), "")
	if err != nil {
		return User{}, err
	}

	return toAPIUser(user, l, auth.MustBooksID(ctx), auth.MustBookRole(ctx)), nil
}

func toAPIUser(u domain.Member, l locale.Locale, booksID int64, role auth.BookRole) User {
	return User{
		Id:          u.ID,
		Email:       u.Email,
		DisplayName: optional(u.DisplayName),
		Role:        UserRole(u.Role),
		Language:    l.Language,
		Region:      l.Region,
		BooksId:     booksID,
		BookRole:    BookRole(role),
	}
}

// optional returns nil for an empty string, so the API omits the field.
func optional(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func deref(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}

// decodeBody decodes the JSON body of r into T. On failure it writes the 400 problem and returns
// false.
func decodeBody[T any](s *Server, w http.ResponseWriter, r *http.Request) (T, bool) {
	var in T
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))
		return in, false
	}

	return in, true
}

// writeJSONCookie answers status with body as JSON and the Set-Cookie header cookie.
func (s *Server) writeJSONCookie(w http.ResponseWriter, r *http.Request, status int, cookie string, body any) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		s.errs.Write(w, r, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Set-Cookie", cookie)
	w.WriteHeader(status)
	_, _ = buf.WriteTo(w)
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

// loginCookie is the cookie of a pending login, sent only to the session routes.
func (s *Server) loginCookie(value string, expires time.Time) string {
	//nolint:gosec // G124: Secure is false only when EQUORI_INSECURE_COOKIES=true (ADR 003).
	c := http.Cookie{
		Name:     loginCookieName,
		Value:    value,
		Path:     "/api/v1/session",
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
	case errors.Is(err, app.ErrConfirmationMismatch):
		return problem.New(http.StatusUnprocessableEntity, "confirmation_mismatch", "the typed name is not the name of the book"), true
	case errors.Is(err, app.ErrBooksHasMembers):
		return problem.New(http.StatusConflict, "books_has_members", "remove the other members before deleting the book"), true
	case errors.Is(err, app.ErrLastBooks):
		return problem.New(http.StatusConflict, "last_books", "a member keeps at least one book"), true
	case errors.Is(err, app.ErrAlreadyMember):
		return problem.New(http.StatusConflict, "already_member", "the email already has a membership in this book"), true
	case errors.Is(err, app.ErrAdminRequired):
		return problem.New(http.StatusForbidden, "admin_required", app.ErrAdminRequired.Error()), true
	case errors.Is(err, app.ErrEmailTaken):
		return problem.New(http.StatusConflict, "email_taken", "a member already has this email"), true
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

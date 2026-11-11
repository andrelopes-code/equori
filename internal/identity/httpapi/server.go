package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
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

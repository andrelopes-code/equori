package httpapi

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getSecondFactor(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (SecondFactor, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return SecondFactor{}, err
	}

	state, err := s.svc.SecondFactor(ctx, member.ID)
	if err != nil {
		return SecondFactor{}, err
	}

	passkeys := make([]Passkey, 0, len(state.Passkeys))
	for _, p := range state.Passkeys {
		passkeys = append(passkeys, toAPIPasskey(p))
	}

	return SecondFactor{
		Totp:              state.TOTP,
		Passkeys:          passkeys,
		RecoveryCodesLeft: state.RecoveryCodesLeft,
	}, nil
}

func (s *Server) startTotp(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (TotpSetup, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return TotpSetup{}, err
	}

	secret, uri, err := s.svc.StartTOTP(ctx, member.ID)
	if err != nil {
		return TotpSetup{}, err
	}

	return TotpSetup{Secret: domain.EncodeTOTPSecret(secret), Uri: uri}, nil
}

func (s *Server) confirmTotp(
	ctx context.Context,
	r *http.Request,
	in ConfirmTotpJSONRequestBody,
) (RecoveryCodes, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return RecoveryCodes{}, err
	}

	codes, err := s.svc.ConfirmTOTP(ctx, member.ID, cookieValue(r, CookieName), in.Code)
	if err != nil {
		return RecoveryCodes{}, err
	}

	return RecoveryCodes{RecoveryCodes: nonNil(codes)}, nil
}

func (s *Server) disableTotp(
	ctx context.Context,
	_ *http.Request,
	in DisableTotpJSONRequestBody,
) (httpserver.None, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DisableTOTP(ctx, member.ID, in.Password); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) regenerateRecoveryCodes(
	ctx context.Context,
	_ *http.Request,
	in RegenerateRecoveryCodesJSONRequestBody,
) (RecoveryCodes, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return RecoveryCodes{}, err
	}

	codes, err := s.svc.RegenerateRecoveryCodes(ctx, member.ID, in.Password)
	if err != nil {
		return RecoveryCodes{}, err
	}

	return RecoveryCodes{RecoveryCodes: nonNil(codes)}, nil
}

func (s *Server) createPasskeyOptions(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (PasskeyOptions, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return PasskeyOptions{}, err
	}

	options, err := s.svc.PasskeyOptions(ctx, member.ID, r.Header.Get("Origin"))
	if err != nil {
		return PasskeyOptions{}, err
	}

	exclude := make([]string, 0, len(options.ExcludeCredentials))
	for _, id := range options.ExcludeCredentials {
		exclude = append(exclude, encodeBinary(id))
	}

	return PasskeyOptions{
		Challenge:          encodeBinary(options.Challenge),
		UserId:             encodeBinary(options.UserID),
		UserName:           options.UserName,
		ExcludeCredentials: exclude,
	}, nil
}

func (s *Server) createPasskey(
	ctx context.Context,
	r *http.Request,
	body CreatePasskeyJSONRequestBody,
) (PasskeyCreated, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return PasskeyCreated{}, err
	}

	in, err := toPasskeyInput(&body)
	if err != nil {
		return PasskeyCreated{}, err
	}

	session, origin := cookieValue(r, CookieName), r.Header.Get("Origin")

	passkey, codes, err := s.svc.CreatePasskey(ctx, member.ID, session, origin, in)
	if err != nil {
		return PasskeyCreated{}, err
	}

	return PasskeyCreated{Passkey: toAPIPasskey(passkey), RecoveryCodes: nonNil(codes)}, nil
}

func (s *Server) removePasskey(
	ctx context.Context,
	r *http.Request,
	in RemovePasskeyJSONRequestBody,
) (httpserver.None, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return httpserver.None{}, err
	}

	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.RemovePasskey(ctx, member.ID, id, in.Password); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

// completeSecondFactor answers 204 with the session cookie and an expired pending login cookie.
func (s *Server) completeSecondFactor(w http.ResponseWriter, r *http.Request) {
	body, ok := decodeBody[CompleteSecondFactorJSONRequestBody](s, w, r)
	if !ok {
		return
	}

	answer, err := toSecondFactorAnswer(&body)
	if err != nil {
		s.errs.Write(w, r, err)
		return
	}

	ctx := r.Context()

	result, err := s.svc.CompleteSecondFactor(
		ctx,
		cookieValue(r, loginCookieName),
		r.Header.Get("Origin"),
		answer,
	)
	if errors.Is(err, app.ErrSecondFactorInvalid) {
		s.log.WarnContext(
			ctx,
			"login failed",
			"member_id",
			result.Session.MemberID,
			"reason",
			err.Error(),
			"request_id",
			httpserver.RequestID(ctx),
		)
	}

	if err != nil {
		s.errs.Write(w, r, err)
		return
	}

	attrs := []any{
		"member_id",
		result.Session.MemberID,
		"books_id",
		result.Session.BooksID,
		"method",
		result.Method,
	}
	if result.Method == app.MethodRecoveryCode {
		attrs = append(attrs, "recovery_codes_left", result.RecoveryCodesLeft)
	}

	s.log.InfoContext(
		ctx,
		"login succeeded",
		append(attrs, "request_id", httpserver.RequestID(ctx))...)

	w.Header().Add("Set-Cookie", s.cookie(result.Session.Token, result.Session.ExpiresAt))
	w.Header().Add("Set-Cookie", s.loginCookie("", time.Unix(0, 0)))
	w.WriteHeader(http.StatusNoContent)
}

// writePendingLogin answers 202 with the second factor challenge and the pending login cookie.
func (s *Server) writePendingLogin(w http.ResponseWriter, r *http.Request, p *app.PendingLogin) {
	challenge := SecondFactorChallenge{
		Methods: make([]SecondFactorChallengeMethods, 0, len(p.Methods)),
	}
	for _, m := range p.Methods {
		challenge.Methods = append(challenge.Methods, SecondFactorChallengeMethods(m))
	}

	if p.Passkey != nil {
		allow := make([]string, 0, len(p.Passkey.AllowCredentials))
		for _, id := range p.Passkey.AllowCredentials {
			allow = append(allow, encodeBinary(id))
		}

		challenge.Passkey = &struct {
			AllowCredentials []string `json:"allow_credentials"`
			Challenge        string   `json:"challenge"`
		}{AllowCredentials: allow, Challenge: encodeBinary(p.Passkey.Challenge)}
	}

	s.writeJSONCookie(w, r, http.StatusAccepted, s.loginCookie(p.Token, p.ExpiresAt), challenge)
}

// cookieValue returns the value of the named cookie, or "" when r has none.
func cookieValue(r *http.Request, name string) string {
	c, err := r.Cookie(name)
	if err != nil {
		return ""
	}

	return c.Value
}

func currentMember(ctx context.Context) (domain.Member, error) {
	member, ok := ctx.Value(memberKey{}).(domain.Member)
	if !ok {
		return domain.Member{}, app.ErrUnauthenticated
	}

	return member, nil
}

func toAPIPasskey(p domain.Passkey) Passkey {
	return Passkey{Id: p.ID, Name: p.Name, CreatedAt: p.CreatedAt, LastUsedAt: p.LastUsedAt}
}

// toPasskeyInput decodes the base64url fields; a malformed one is passkey_invalid.
func toPasskeyInput(b *CreatePasskeyJSONRequestBody) (app.PasskeyInput, error) {
	clientData, err1 := base64.RawURLEncoding.DecodeString(b.ClientDataJson)
	authData, err2 := base64.RawURLEncoding.DecodeString(b.AuthenticatorData)
	publicKey, err3 := base64.RawURLEncoding.DecodeString(b.PublicKey)

	if err := errors.Join(err1, err2, err3); err != nil {
		return app.PasskeyInput{}, app.ErrPasskeyInvalid
	}

	return app.PasskeyInput{
		Name:              b.Name,
		ClientDataJSON:    clientData,
		AuthenticatorData: authData,
		PublicKey:         publicKey,
		Algorithm:         b.Algorithm,
	}, nil
}

func encodeBinary(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

// nonNil makes a nil list encode as [].
func nonNil(codes []string) []string {
	if codes == nil {
		return []string{}
	}

	return codes
}

// toSecondFactorAnswer requires exactly one answer field; a value that is not base64url decodes to
// an empty value, which fails verification and counts as an attempt.
func toSecondFactorAnswer(b *CompleteSecondFactorJSONRequestBody) (app.SecondFactorAnswer, error) {
	given := 0

	if b.TotpCode != nil {
		given++
	}

	if b.RecoveryCode != nil {
		given++
	}

	if b.Passkey != nil {
		given++
	}

	if given != 1 {
		return app.SecondFactorAnswer{}, errInvalidRequest
	}

	answer := app.SecondFactorAnswer{
		TOTPCode:     deref(b.TotpCode),
		RecoveryCode: deref(b.RecoveryCode),
	}

	if b.Passkey != nil {
		answer.Passkey = &app.Assertion{
			CredentialID:      decodeOrEmpty(b.Passkey.CredentialId),
			ClientDataJSON:    decodeOrEmpty(b.Passkey.ClientDataJson),
			AuthenticatorData: decodeOrEmpty(b.Passkey.AuthenticatorData),
			Signature:         decodeOrEmpty(b.Passkey.Signature),
		}
	}

	return answer, nil
}

func decodeOrEmpty(s string) []byte {
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil
	}

	return b
}

package httpapi

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) GetSecondFactor(ctx context.Context, _ GetSecondFactorRequestObject) (GetSecondFactorResponseObject, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return nil, err
	}

	state, err := s.svc.SecondFactor(ctx, member.ID)
	if err != nil {
		return nil, err
	}

	passkeys := make([]Passkey, 0, len(state.Passkeys))
	for _, p := range state.Passkeys {
		passkeys = append(passkeys, toAPIPasskey(p))
	}

	return GetSecondFactor200JSONResponse{Totp: state.TOTP, Passkeys: passkeys, RecoveryCodesLeft: state.RecoveryCodesLeft}, nil
}

func (s *Server) StartTotp(ctx context.Context, _ StartTotpRequestObject) (StartTotpResponseObject, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return nil, err
	}

	secret, uri, err := s.svc.StartTOTP(ctx, member.ID)
	if err != nil {
		return nil, err
	}

	return StartTotp200JSONResponse{Secret: domain.EncodeTOTPSecret(secret), Uri: uri}, nil
}

func (s *Server) ConfirmTotp(ctx context.Context, req ConfirmTotpRequestObject) (ConfirmTotpResponseObject, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return nil, err
	}

	if req.Body == nil {
		return nil, errInvalidRequest
	}

	codes, err := s.svc.ConfirmTOTP(ctx, member.ID, deref(req.Params.EquoriSession), req.Body.Code)
	if err != nil {
		return nil, err
	}

	return ConfirmTotp200JSONResponse{RecoveryCodes: nonNil(codes)}, nil
}

func (s *Server) DisableTotp(ctx context.Context, req DisableTotpRequestObject) (DisableTotpResponseObject, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return nil, err
	}

	if req.Body == nil {
		return nil, errInvalidRequest
	}

	if err := s.svc.DisableTOTP(ctx, member.ID, req.Body.Password); err != nil {
		return nil, err
	}

	return DisableTotp204Response{}, nil
}

func (s *Server) RegenerateRecoveryCodes(ctx context.Context, req RegenerateRecoveryCodesRequestObject) (RegenerateRecoveryCodesResponseObject, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return nil, err
	}

	if req.Body == nil {
		return nil, errInvalidRequest
	}

	codes, err := s.svc.RegenerateRecoveryCodes(ctx, member.ID, req.Body.Password)
	if err != nil {
		return nil, err
	}

	return RegenerateRecoveryCodes200JSONResponse{RecoveryCodes: nonNil(codes)}, nil
}

func (s *Server) CreatePasskeyOptions(ctx context.Context, req CreatePasskeyOptionsRequestObject) (CreatePasskeyOptionsResponseObject, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return nil, err
	}

	options, err := s.svc.PasskeyOptions(ctx, member.ID, deref(req.Params.Origin))
	if err != nil {
		return nil, err
	}

	exclude := make([]string, 0, len(options.ExcludeCredentials))
	for _, id := range options.ExcludeCredentials {
		exclude = append(exclude, encodeBinary(id))
	}

	return CreatePasskeyOptions200JSONResponse{
		Challenge:          encodeBinary(options.Challenge),
		UserId:             encodeBinary(options.UserID),
		UserName:           options.UserName,
		ExcludeCredentials: exclude,
	}, nil
}

func (s *Server) CreatePasskey(ctx context.Context, req CreatePasskeyRequestObject) (CreatePasskeyResponseObject, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return nil, err
	}

	if req.Body == nil {
		return nil, errInvalidRequest
	}

	in, err := toPasskeyInput(req.Body)
	if err != nil {
		return nil, err
	}

	passkey, codes, err := s.svc.CreatePasskey(ctx, member.ID, deref(req.Params.EquoriSession), deref(req.Params.Origin), in)
	if err != nil {
		return nil, err
	}

	return CreatePasskey201JSONResponse{Passkey: toAPIPasskey(passkey), RecoveryCodes: nonNil(codes)}, nil
}

func (s *Server) RemovePasskey(ctx context.Context, req RemovePasskeyRequestObject) (RemovePasskeyResponseObject, error) {
	member, err := currentMember(ctx)
	if err != nil {
		return nil, err
	}

	if req.Body == nil {
		return nil, errInvalidRequest
	}

	if err := s.svc.RemovePasskey(ctx, member.ID, req.Id, req.Body.Password); err != nil {
		return nil, err
	}

	return RemovePasskey204Response{}, nil
}

func (s *Server) CompleteSecondFactor(ctx context.Context, req CompleteSecondFactorRequestObject) (CompleteSecondFactorResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	answer, err := toSecondFactorAnswer(req.Body)
	if err != nil {
		return nil, err
	}

	result, err := s.svc.CompleteSecondFactor(ctx, deref(req.Params.EquoriLogin), deref(req.Params.Origin), answer)
	if errors.Is(err, app.ErrSecondFactorInvalid) {
		s.log.WarnContext(ctx, "login failed", "member_id", result.Session.MemberID, "reason", err.Error(),
			"request_id", httpserver.RequestID(ctx))
	}

	if err != nil {
		return nil, err
	}

	attrs := []any{"member_id", result.Session.MemberID, "books_id", result.Session.BooksID, "method", result.Method}
	if result.Method == app.MethodRecoveryCode {
		attrs = append(attrs, "recovery_codes_left", result.RecoveryCodesLeft)
	}

	s.log.InfoContext(ctx, "login succeeded", append(attrs, "request_id", httpserver.RequestID(ctx))...)

	return secondFactorDone{
		session: s.cookie(result.Session.Token, result.Session.ExpiresAt),
		login:   s.loginCookie("", time.Unix(0, 0)),
	}, nil
}

// secondFactorDone answers 204 with the session cookie and an expired pending login cookie.
type secondFactorDone struct {
	session, login string
}

func (d secondFactorDone) VisitCompleteSecondFactorResponse(w http.ResponseWriter) error {
	w.Header().Add("Set-Cookie", d.session)
	w.Header().Add("Set-Cookie", d.login)
	w.WriteHeader(http.StatusNoContent)

	return nil
}

func (s *Server) pendingLoginResponse(p *app.PendingLogin) CreateSessionResponseObject {
	challenge := SecondFactorChallenge{Methods: make([]SecondFactorChallengeMethods, 0, len(p.Methods))}
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

	cookie := s.loginCookie(p.Token, p.ExpiresAt)

	return CreateSession202JSONResponse{Body: challenge, Headers: CreateSession202ResponseHeaders{SetCookie: &cookie}}
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

	answer := app.SecondFactorAnswer{TOTPCode: deref(b.TotpCode), RecoveryCode: deref(b.RecoveryCode)}

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

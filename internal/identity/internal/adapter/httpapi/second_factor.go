package httpapi

import (
	"context"
	"encoding/base64"
	"errors"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
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

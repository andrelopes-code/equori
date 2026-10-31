package httpapi

import (
	"context"

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

// nonNil makes a nil list encode as [].
func nonNil(codes []string) []string {
	if codes == nil {
		return []string{}
	}

	return codes
}

package httpapi

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) GetMemberAppearance(ctx context.Context, _ GetMemberAppearanceRequestObject) (GetMemberAppearanceResponseObject, error) {
	doc, err := s.svc.Appearance(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return nil, err
	}

	var appearance Appearance
	if err := json.Unmarshal(doc, &appearance); err != nil {
		return nil, fmt.Errorf("decode stored appearance: %w", err)
	}

	return GetMemberAppearance200JSONResponse(appearance), nil
}

func (s *Server) SetMemberAppearance(ctx context.Context, req SetMemberAppearanceRequestObject) (SetMemberAppearanceResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	doc, err := json.Marshal(req.Body)
	if err != nil {
		return nil, fmt.Errorf("encode appearance: %w", err)
	}

	if err := s.svc.SetAppearance(ctx, auth.MustMemberID(ctx), doc); err != nil {
		return nil, err
	}

	return SetMemberAppearance200JSONResponse(*req.Body), nil
}
